import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getDashboardCacheScope, invokeDashboardApi } from '../../../utils/supabaseSession';
import {
  getNaverMapsClientId,
  loadLeafletSdk,
  loadNaverMapsSdk as loadSharedNaverMapsSdk,
  MapLayerControl,
} from './LogisticsMapRuntime';

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
const TRANSACTION_SIZE_BUCKET_RULES = [
  { value: '소형', min: 0, max: 10000, description: '10,000평 미만' },
  { value: '중형', min: 10000, max: 30000, description: '10,000평 이상, 30,000평 미만' },
  { value: '대형', min: 30000, max: 50000, description: '30,000평 이상, 50,000평 미만' },
  { value: '초대형', min: 50000, max: Infinity, description: '50,000평 이상' },
];
const TRANSACTION_SIZE_BUCKET_VALUES = TRANSACTION_SIZE_BUCKET_RULES.map((rule) => rule.value);
const TRANSACTION_TEMPERATURE_OPTIONS = ['전체', '상온', '저온', '복합'];
const REGION_SERIES_COLORS = {
  동남권: '#9AD7FF',
  남부권: '#B5E48C',
  중앙권: '#FFD166',
  서부권: '#A78BFA',
  서북권: '#FCA5A5',
  '수도권 기타권': '#7DD3FC',
  경남권: '#86EFAC',
  충청권: '#FBBF24',
  전라권: '#F0ABFC',
  경북권: '#93C5FD',
  '지방 기타권': '#D1D5DB',
};

const SOURCE_DOMAINS = [
  { key: 'lease_contracts', label: '임대차' },
  { key: 'fund_info', label: '펀드/금융' },
  { key: 'sector_market', label: '시장자료' },
  { key: 'permissions', label: '권한/사용자' },
  { key: 'asset_specs', label: '자산 스펙' },
  { key: 'operating_costs', label: '운영비용' },
];
const DATA_MANAGEMENT_DOMAINS = SOURCE_DOMAINS;
const DATA_MANAGEMENT_DOMAIN_KEYS = new Set(DATA_MANAGEMENT_DOMAINS.map((domain) => domain.key));
const SUPPLY_PERIOD_DEFAULT_START = '2024-01-01';
const SUPPLY_PERIOD_DEFAULT_END = '2028-12-31';

const MARKET_TABS = [
  { id: 'overview', route: 'overview', label: 'Overview' },
  { id: 'lease', route: 'lease-market', label: 'Lease Market' },
  { id: 'supply', route: 'supply-pipeline', label: 'Supply Pipeline' },
  { id: 'transactions', route: 'transactions', label: 'Transactions' },
  { id: 'source', route: 'source-update', label: 'Source Update' },
];

const MARKET_TAB_TITLES = {
  overview: '시장 데이터 개요',
  lease: '임대 시장 분석',
  supply: '공급 파이프라인',
  transactions: '매매 거래 분석',
  source: '원천 데이터 업데이트',
};

const MARKET_TAB_SUBTITLES = {
  overview: '임대료, 거래금액, 공급 예정 시점, Cap Rate를 한 화면에서 빠르게 확인합니다.',
  lease: '임대시장 통계와 센터별 임대 현황을 시점, 권역, 상/저온 기준으로 비교합니다.',
  supply: '신규 공급, 공급 예정, 누적 공급을 지도, 표, 시계열로 함께 확인합니다.',
  transactions: '매매사례를 기간, 권역, 상/저온, 실물·선매입 기준으로 분석합니다.',
  source: '분기별 Excel 원천의 적재 상태, 검증 결과, active 교체 흐름을 관리합니다.',
};

const MARKET_VIEW_LIMITS = {
  overview: 900,
  lease: 1800,
  supply: 1400,
  transactions: 1800,
  source: 1200,
};

function marketReadPayloadFor(tabId) {
  return { view: tabId, limit: MARKET_VIEW_LIMITS[tabId] || 1200 };
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function firstNonEmptyObject(...values) {
  return values.find((value) => (
    value
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.keys(value).length > 0
  )) || {};
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

function stripLeadingNumberLabel(value) {
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
  const display = publicDisplayText(value, '-');
  if (/\?{4,}/u.test(display)) {
    const cleaned = display.replace(/\?{4,}/gu, '').replace(/\s{2,}/gu, ' ').trim();
    return cleaned || '-';
  }
  return display;
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
  return key ? formatDisplayValue(values[key], key) : text(row?.natural_key, '관리 대상');
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

function transactionSizeBucketFor(rowOrArea) {
  const area = typeof rowOrArea === 'object' ? number(rowOrArea?.area_py) : number(rowOrArea);
  const rule = TRANSACTION_SIZE_BUCKET_RULES.find((item) => area >= item.min && area < item.max);
  return rule?.value || '미분류';
}

function normalizeMarketTemperature(value) {
  const raw = text(value, '').trim();
  const normalized = raw.toUpperCase();
  if (!raw) return '미분류';
  if (/MIX|복합/u.test(normalized)) return '복합';
  if (/COLD|저온|냉장|냉동/u.test(normalized)) return '저온';
  if (/DRY|상온|AMBIENT/u.test(normalized)) return '상온';
  return raw;
}

function transactionTemperatureFor(row) {
  return normalizeMarketTemperature(firstText(row?.temperature_type, row?.storage_type, row?.warehouse_type));
}

function formatNumber(value, digits = 0) {
  if (value === null || value === undefined || value === '') return '-';
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
  if (Math.abs(parsed) >= 1000000000000) {
    const sign = parsed < 0 ? '-' : '';
    const abs = Math.abs(parsed);
    const jo = Math.floor(abs / 1000000000000);
    const remainderEok = (abs - (jo * 1000000000000)) / 100000000;
    return remainderEok >= 0.05
      ? `${sign}${formatNumber(jo, 0)}조 ${formatNumber(remainderEok, 1)}억원`
      : `${sign}${formatNumber(jo, 0)}조원`;
  }
  if (Math.abs(parsed) >= 100000000) return `${formatNumber(parsed / 100000000, 1)}억원`;
  if (Math.abs(parsed) >= 10000) return `${formatNumber(parsed / 10000, 0)}만원`;
  return `${formatNumber(parsed, 0)}원`;
}

function formatKrwAxis(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return '0';
  if (Math.abs(parsed) >= 1000000000000) {
    const jo = parsed / 1000000000000;
    return `${formatNumber(jo, Number.isInteger(jo) ? 0 : 1)}조`;
  }
  if (Math.abs(parsed) >= 100000000) return `${formatNumber(parsed / 100000000, parsed >= 1000000000 ? 0 : 1)}억`;
  if (Math.abs(parsed) >= 10000) return `${formatNumber(parsed / 10000, 0)}만`;
  return formatNumber(parsed, 0);
}

function hasDisplayNumber(value) {
  if (value === null || value === undefined || value === '') return false;
  return Number.isFinite(Number(value));
}

function formatManwon(value, digits = 1) {
  return hasDisplayNumber(value) ? `${formatNumber(value, digits)}만원` : '';
}

const LOAN_MATURITY_AXIS_STEP_KRW = 50000000000;

function loanMaturityAxis(maxValue) {
  const safeMax = Math.max(number(maxValue), LOAN_MATURITY_AXIS_STEP_KRW);
  const maxTick = Math.ceil(safeMax / LOAN_MATURITY_AXIS_STEP_KRW) * LOAN_MATURITY_AXIS_STEP_KRW;
  const ticks = [];
  for (let value = 0; value <= maxTick; value += LOAN_MATURITY_AXIS_STEP_KRW) ticks.push(value);
  return { maxTick, ticks };
}

function formatRate(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '-';
  const normalized = Math.abs(parsed) <= 1 ? parsed * 100 : parsed;
  return `${formatNumber(normalized, 2)}%`;
}

function normalizeRateRatio(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.abs(parsed) > 1 ? parsed / 100 : parsed;
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
  동남권: [37.205, 127.36],
  남부권: [37.135, 127.02],
  중앙권: [37.42, 127.08],
  서부권: [37.43, 126.72],
  서북권: [37.70, 126.75],
  '수도권 기타권': [37.54, 127.22],
  경남권: [35.23, 128.72],
  충청권: [36.55, 127.16],
  전라권: [35.42, 127.04],
  경북권: [36.10, 128.55],
  '지방 기타권': [36.15, 128.10],
};
const REGION_CLUSTER_COORDS = {
  동남권: [37.02, 127.72],
  남부권: [36.74, 127.04],
  중앙권: [37.44, 127.20],
  서부권: [37.32, 126.46],
  서북권: [37.68, 126.55],
  '수도권 기타권': [37.72, 127.54],
  경남권: [35.00, 128.92],
  충청권: [36.18, 127.24],
  전라권: [34.82, 126.72],
  경북권: [36.06, 129.12],
  '지방 기타권': [35.42, 127.68],
};
const REGION_OVERVIEW_CENTER = [36.55, 127.75];
const REGION_OVERVIEW_ZOOM = 7;
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

function compactRegionLabel(value) {
  return text(value).replace(/^\([^)]+\)\s*/u, '');
}

function regionOrderIndex(value) {
  const compact = compactRegionLabel(value);
  const index = REGION_ORDER.indexOf(compact);
  return index === -1 ? 999 : index;
}

function regionDisplayParts(value) {
  const region = regionValue(value);
  const scope = REGION_SCOPE.get(region);
  const shortRegion = region.replace(/^(수도권|지방)\s*/u, '').replace(/\s*기타권$/u, ' 기타');
  return { scope, region: shortRegion || region };
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

function isUnknownPeriodLabel(value) {
  const source = text(value, '').replace(/\s+/gu, '').trim();
  return !source || /미정|미확정|unknown|tbd|n\/a/iu.test(source);
}

function periodSortValue(value) {
  const source = text(value, '').replace(/\s+/gu, ' ').trim();
  const compact = source.replace(/[\s._-]+/gu, '');
  const match = compact.match(/^(20\d{2})(?:(\d)Q|Q([1-4])|([12])H|H([12]))?$/u);
  if (match) {
    const year = Number(match[1]);
    const quarter = match[2] ? Number(match[2]) : (match[3] ? Number(match[3]) : (match[4] === '1' || match[5] === '1' ? 2 : match[4] === '2' || match[5] === '2' ? 4 : 1));
    return year * 10 + quarter;
  }
  const dateMatch = source.match(/(20\d{2})/u);
  return dateMatch ? Number(dateMatch[1]) * 10 : 99999;
}

function periodAxisParts(value) {
  const source = text(value, '').replace(/\s+/gu, ' ').trim();
  const compact = source.replace(/[\s._-]+/gu, '');
  const match = compact.match(/^(20\d{2})(?:(\d)Q|Q([1-4])|([12])H|H([12]))?$/u);
  if (!match) return { sub: source, year: '' };
  if (match[2] || match[3]) return { sub: `${match[2] || match[3]}Q`, year: match[1] };
  if (match[4] || match[5]) return { sub: `${match[4] || match[5]}H`, year: match[1] };
  return { sub: match[1], year: '' };
}

function periodDate(value, end = false) {
  const source = text(value, '').replace(/\s+/gu, '');
  const match = source.match(/^(20\d{2})(?:(\d)Q|Q([1-4])|([12])H|H([12]))?$/u);
  if (!match) {
    const year = (source.match(/(20\d{2})/u) || [])[1];
    return year ? `${year}-${end ? '12-31' : '01-01'}` : '';
  }
  const year = match[1];
  if (match[2] || match[3]) {
    const quarter = Number(match[2] || match[3]);
    const startMonth = String((quarter - 1) * 3 + 1).padStart(2, '0');
    const endMonth = String(quarter * 3).padStart(2, '0');
    return end ? `${year}-${endMonth}-28` : `${year}-${startMonth}-01`;
  }
  if (match[4] || match[5]) return (match[4] || match[5]) === '1' ? `${year}-${end ? '06-30' : '01-01'}` : `${year}-${end ? '12-31' : '07-01'}`;
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
const EDGE_DATA_CACHE_TTL_MS = 10 * 60 * 1000;
const EDGE_DATA_REVALIDATE_MS = 90 * 1000;
const EDGE_DATA_CACHE = new Map();
const EDGE_DATA_INFLIGHT = new Map();

function edgeCacheKey(action, payload = {}) {
  try {
    return `${getDashboardCacheScope()}:${action}:${JSON.stringify(payload || {})}`;
  } catch {
    return `${getDashboardCacheScope()}:${action}:unserializable`;
  }
}

function hasEdgeDataRows(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (!value || typeof value !== 'object') return false;
  if (safeArray(value.rows).length) return true;
  if (safeArray(value.sources).length || safeArray(value.source_rows).length || safeArray(value.sheet_readback).length) return true;
  if (safeArray(value.source_audit?.sheet_readback).length || safeArray(value.sourceAudit?.sheet_readback).length) return true;
  if (safeArray(value.leases).length || safeArray(value.supply).length || safeArray(value.transactions).length || safeArray(value.cap_rates).length) return true;
  const views = value.views && typeof value.views === 'object' ? value.views : {};
  return Object.values(views).some((view) => {
    if (!view || typeof view !== 'object') return false;
    if (safeArray(view.rows).length || safeArray(view.latest_rows).length || safeArray(view.history_rows).length || safeArray(view.statistics_rows).length) return true;
    const charts = view.charts && typeof view.charts === 'object' ? view.charts : {};
    return Object.values(charts).some((rows) => safeArray(rows).length);
  });
}

function shouldCacheEdgeData(action, value) {
  if (action === 'sector-market/read') return hasEdgeDataRows(value);
  if (action === 'data-management/status') return hasEdgeDataRows(value) || safeArray(value?.sources).length || safeArray(value?.source_rows).length;
  return true;
}

async function primeEdgeData(action, payload = {}) {
  const requestKey = edgeCacheKey(action, payload);
  const cached = EDGE_DATA_CACHE.get(requestKey);
  if (cached && Date.now() - cached.loadedAt < EDGE_DATA_CACHE_TTL_MS) return cached.data;
  let requestPromise = EDGE_DATA_INFLIGHT.get(requestKey);
  if (!requestPromise) {
    requestPromise = invoke(action, payload).finally(() => {
      EDGE_DATA_INFLIGHT.delete(requestKey);
    });
    EDGE_DATA_INFLIGHT.set(requestKey, requestPromise);
  }
  const data = await requestPromise;
  if (shouldCacheEdgeData(action, data)) EDGE_DATA_CACHE.set(requestKey, { data, loadedAt: Date.now() });
  return data;
}

function useEdgeData(action, payload = {}, deps = []) {
  const payloadKey = edgeCacheKey(action, payload);
  const cachedState = EDGE_DATA_CACHE.get(payloadKey);
  const [state, setState] = useState(() => (
    cachedState
      ? { loading: false, error: '', data: cachedState.data, loadedAt: cachedState.loadedAt, sourceKey: payloadKey }
      : { loading: true, error: '', data: null, loadedAt: 0, sourceKey: payloadKey }
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
    if (options.force) EDGE_DATA_INFLIGHT.delete(requestKey);
    const cached = EDGE_DATA_CACHE.get(requestKey);
    const cachedAge = cached ? Date.now() - cached.loadedAt : Number.POSITIVE_INFINITY;
    if (!options.force && !Object.keys(normalizedOverride).length && cached && cachedAge < EDGE_DATA_CACHE_TTL_MS) {
      if (mountedRef.current) setState({ loading: false, error: '', data: cached.data, loadedAt: cached.loadedAt, sourceKey: requestKey });
      if (cachedAge >= EDGE_DATA_REVALIDATE_MS && !options.__revalidate) {
        window.setTimeout(() => {
          if (mountedRef.current) reload({}, { silent: true, force: true, __revalidate: true });
        }, 0);
      }
      return cached.data;
    }
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    if (cached && mountedRef.current) {
      setState({ loading: false, error: '', data: cached.data, loadedAt: cached.loadedAt, sourceKey: requestKey });
    } else if (!options.silent && mountedRef.current) {
      setState((current) => ({
        ...current,
        loading: !(current.data && current.sourceKey === requestKey),
        data: current.sourceKey === requestKey ? current.data : null,
        error: '',
        sourceKey: requestKey,
      }));
    }
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
      if (shouldCacheEdgeData(action, data)) EDGE_DATA_CACHE.set(requestKey, { data, loadedAt });
      else EDGE_DATA_CACHE.delete(requestKey);
      if (mountedRef.current && requestRef.current === requestId) {
        setState({ loading: false, error: '', data, loadedAt, sourceKey: requestKey });
      }
      return data;
    } catch {
      if (!options.__retry) {
        await new Promise((resolve) => window.setTimeout(resolve, 450));
        return reload(normalizedOverride, { ...options, force: true, silent: Boolean(stateRef.current.data), __retry: true });
      }
      const fallbackCached = EDGE_DATA_CACHE.get(requestKey) || EDGE_DATA_CACHE.get(payloadKey);
      if (mountedRef.current && requestRef.current === requestId) {
        setState((current) => ({
          loading: false,
          error: USER_FACING_LOAD_ERROR_TEXT,
          data: current.sourceKey === requestKey ? (current.data || fallbackCached?.data || null) : (fallbackCached?.data || null),
          loadedAt: current.sourceKey === requestKey ? (current.loadedAt || fallbackCached?.loadedAt || 0) : (fallbackCached?.loadedAt || 0),
          sourceKey: requestKey,
        }));
      }
      return null;
    }
  };
  useEffect(() => {
    mountedRef.current = true;
    const cached = EDGE_DATA_CACHE.get(payloadKey);
    if (cached) {
      setState({ loading: false, error: '', data: cached.data, loadedAt: cached.loadedAt, sourceKey: payloadKey });
      if (Date.now() - cached.loadedAt >= EDGE_DATA_REVALIDATE_MS) reload({}, { silent: true, force: true });
      return () => {
        mountedRef.current = false;
      };
    }
    if (stateRef.current.sourceKey !== payloadKey) {
      setState({ loading: true, error: '', data: null, loadedAt: 0, sourceKey: payloadKey });
    }
    reload({}, { silent: stateRef.current.sourceKey === payloadKey && Boolean(stateRef.current.data) });
    return () => {
      mountedRef.current = false;
    };
  }, [payloadKey, ...deps]);
  useEffect(() => {
    const refreshIfStale = () => {
      if (document.visibilityState && document.visibilityState !== 'visible') return;
      const current = stateRef.current;
      const stale = current.loadedAt && Date.now() - current.loadedAt > EDGE_DATA_REVALIDATE_MS;
      if (current.error || !current.data || stale) reload({}, { silent: Boolean(current.data), force: true });
    };
    window.addEventListener('focus', refreshIfStale);
    window.addEventListener('online', refreshIfStale);
    window.addEventListener('popstate', refreshIfStale);
    window.addEventListener('logistics-data-refresh', refreshIfStale);
    document.addEventListener('visibilitychange', refreshIfStale);
    return () => {
      window.removeEventListener('focus', refreshIfStale);
      window.removeEventListener('online', refreshIfStale);
      window.removeEventListener('popstate', refreshIfStale);
      window.removeEventListener('logistics-data-refresh', refreshIfStale);
      document.removeEventListener('visibilitychange', refreshIfStale);
    };
  }, [payloadKey, ...deps]);
  return { ...state, reload };
}

function ModuleHeader({ eyebrow, title, subtitle = '', right = null }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        {eyebrow ? <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#86868B]">{eyebrow}</div> : null}
        <h2 className={`${eyebrow ? 'mt-1' : ''} text-[24px] font-semibold tracking-tight text-white`}>{title}</h2>
        {subtitle ? <p className="mt-1 max-w-[860px] text-[12px] leading-5 text-[#A1A1AA]">{subtitle}</p> : null}
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
    const criteria = Array.isArray(sort) ? sort.filter((item) => item?.key) : (sort?.key ? [sort] : []);
    if (!criteria.length) return source;
    const compareBy = (criterion, a, b) => {
      const column = columns.find((item) => item.key === criterion.key);
      const sortValue = column?.sortValue || ((row) => row?.[criterion.key]);
      const left = sortValue(a);
      const right = sortValue(b);
      const leftMissing = left === null || left === undefined || left === '';
      const rightMissing = right === null || right === undefined || right === '';
      if (leftMissing || rightMissing) {
        if (leftMissing && rightMissing) return 0;
        return leftMissing ? 1 : -1;
      }
      const leftNumber = Number(left);
      const rightNumber = Number(right);
      let result = 0;
      if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
        result = leftNumber - rightNumber;
      } else {
        result = String(left ?? '').localeCompare(String(right ?? ''), 'ko');
      }
      return criterion.direction === 'desc' ? -result : result;
    };
    return source.slice().sort((a, b) => {
      for (const criterion of criteria) {
        const result = compareBy(criterion, a, b);
        if (result !== 0) return result;
      }
      return 0;
    });
  }, [columns, rows, sort]);
  const nextSort = (column) => {
    if (column.sortable === false) return;
    setSort((current) => ({
      key: column.key,
      direction: current?.key === column.key && current.direction === 'asc' ? 'desc' : 'asc',
    }));
  };
  const columnWidth = (column) => number(column.width || 168);
  const stickyLeft = (index) => `${columns.slice(0, index).reduce((sum, column) => sum + columnWidth(column), 0)}px`;
  return (
    <div className="custom-scrollbar overflow-auto rounded-[12px] border border-[#333333]" style={{ maxHeight }} data-sortable-table="true">
      <table className="w-full border-separate text-left text-[12px]" style={{ minWidth, borderSpacing: 0 }}>
        <colgroup>
          {columns.map((column) => <col key={column.key} style={{ width: `${columnWidth(column)}px` }} />)}
        </colgroup>
        <thead className="sticky top-0 z-20 bg-[#1F1F1E] text-[#A1A1AA]">
          <tr>
            {columns.map((column, index) => {
              const sticky = index < stickyCount;
              const activeSort = Array.isArray(sort) ? sort.find((item) => item?.key === column.key) : (sort?.key === column.key ? sort : null);
              const lastSticky = sticky && index === stickyCount - 1;
              return (
                <th
                  key={column.key}
                  style={{ width: `${columnWidth(column)}px`, minWidth: `${columnWidth(column)}px`, maxWidth: `${columnWidth(column)}px`, left: sticky ? stickyLeft(index) : undefined }}
                  className={`whitespace-nowrap border-b border-[#303033] px-3 py-2 font-semibold ${sticky ? `sticky z-30 bg-[#1F1F1E] ${lastSticky ? 'shadow-[10px_0_12px_-12px_rgba(0,0,0,0.95)]' : ''}` : 'bg-[#1F1F1E]'}`}
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
                    {column.sortable === false ? null : <span className={`text-[10px] ${activeSort ? 'text-white' : 'text-[#5f5f64]'}`}>{activeSort ? (activeSort.direction === 'asc' ? '▲' : '▼') : '↕'}</span>}
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
                const lastSticky = sticky && index === stickyCount - 1;
                const value = column.render ? column.render(row) : row[column.key];
                const wrapCell = column.noTruncate || column.wrap;
                return (
                  <td
                    key={column.key}
                    style={{ width: `${columnWidth(column)}px`, minWidth: `${columnWidth(column)}px`, maxWidth: `${columnWidth(column)}px`, left: sticky ? stickyLeft(index) : undefined }}
                    className={`${wrapCell ? 'whitespace-normal break-keep' : 'truncate'} px-3 py-2 align-top ${column.align === 'right' ? 'text-right' : ''} ${sticky ? `sticky z-10 bg-[#171717] ${lastSticky ? 'shadow-[10px_0_12px_-12px_rgba(0,0,0,0.95)]' : ''}` : 'bg-[#171717]'}`}
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
  useEffect(() => {
    if (!title) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [title, onClose]);
  if (!title) return null;
  return (
    <div className={`fixed inset-0 isolate z-[2147483000] bg-black/70 px-4 ${fullscreen ? 'py-4' : 'py-8'}`} role="dialog" aria-modal="true">
      <div className={`relative z-[1] mx-auto ${fullscreen ? 'h-[calc(100vh-32px)] max-h-[calc(100vh-32px)]' : 'max-h-[86vh]'} ${width} overflow-hidden rounded-[16px] border border-[#3A3A3C] bg-[#1F1F1E] shadow-2xl`}>
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
    <div className="min-w-0">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#86868B]">{label}</div>
      <div className="custom-scrollbar flex max-w-full gap-1 overflow-x-auto pb-1">
        {options.map((option) => {
          const optionValue = typeof option === 'string' ? option : option.value;
          const optionLabel = typeof option === 'string' ? option : option.label;
          return (
            <button
              key={optionValue}
              type="button"
              onClick={() => onChange(optionValue)}
              className={`h-7 shrink-0 rounded-full border px-2.5 text-[11px] font-semibold ${value === optionValue ? 'border-white bg-white text-[#1F1F1E]' : 'border-[#3A3A3C] text-[#A1A1AA] hover:text-white'}`}
            >
              {optionLabel}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const OSM_TILE_SIZE = 256;
const OSM_VIEW_WIDTH = 960;
const OSM_VIEW_HEIGHT = 520;

function osmWorldPoint(lat, lng, zoom) {
  const safeLat = Math.max(-85.05112878, Math.min(85.05112878, Number(lat)));
  const safeLng = Number(lng);
  if (!Number.isFinite(safeLat) || !Number.isFinite(safeLng)) return null;
  const scale = 2 ** zoom;
  const latRad = (safeLat * Math.PI) / 180;
  return {
    x: ((safeLng + 180) / 360) * scale * OSM_TILE_SIZE,
    y: ((1 - Math.log(Math.tan(latRad) + (1 / Math.cos(latRad))) / Math.PI) / 2) * scale * OSM_TILE_SIZE,
  };
}

function clampPercent(value, min = 2, max = 98) {
  return Math.max(min, Math.min(max, value));
}

function spreadPercentPositions(items, minDistance, bounds = {}) {
  const leftMin = bounds.leftMin ?? 2;
  const leftMax = bounds.leftMax ?? 98;
  const topMin = bounds.topMin ?? 2;
  const topMax = bounds.topMax ?? 98;
  const positions = safeArray(items).map((item, index) => ({
    ...item,
    index,
    left: clampPercent(Number(item.left), leftMin, leftMax),
    top: clampPercent(Number(item.top), topMin, topMax),
  }));
  for (let iteration = 0; iteration < 100; iteration += 1) {
    let moved = false;
    for (let leftIndex = 0; leftIndex < positions.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < positions.length; rightIndex += 1) {
        const left = positions[leftIndex];
        const right = positions[rightIndex];
        let dx = right.left - left.left;
        let dy = right.top - left.top;
        let distance = Math.hypot(dx, dy);
        if (!Number.isFinite(distance) || distance < 0.001) {
          const angle = ((Math.PI * 2) * (leftIndex + rightIndex + 1)) / Math.max(positions.length, 1);
          dx = Math.cos(angle);
          dy = Math.sin(angle);
          distance = 1;
        }
        if (distance >= minDistance) continue;
        const push = (minDistance - distance) / 2;
        const ux = dx / distance;
        const uy = dy / distance;
        left.left = clampPercent(left.left - (ux * push), leftMin, leftMax);
        left.top = clampPercent(left.top - (uy * push), topMin, topMax);
        right.left = clampPercent(right.left + (ux * push), leftMin, leftMax);
        right.top = clampPercent(right.top + (uy * push), topMin, topMax);
        left.collisionAdjusted = true;
        right.collisionAdjusted = true;
        moved = true;
      }
    }
    if (!moved) break;
  }
  return positions;
}

function buildOsmTileLayout(rows, zoom) {
  const points = safeArray(rows)
    .map((row) => ({ row, point: osmWorldPoint(row.lat, row.lng, zoom) }))
    .filter((item) => item.point);
  if (!points.length) return { zoom, tiles: [], pointPositions: new Map() };
  const centerX = points.reduce((sum, item) => sum + item.point.x, 0) / points.length;
  const centerY = points.reduce((sum, item) => sum + item.point.y, 0) / points.length;
  const startX = centerX - (OSM_VIEW_WIDTH / 2);
  const startY = centerY - (OSM_VIEW_HEIGHT / 2);
  const scale = 2 ** zoom;
  const maxTile = scale - 1;
  const tiles = [];
  const startTileX = Math.floor(startX / OSM_TILE_SIZE);
  const endTileX = Math.floor((startX + OSM_VIEW_WIDTH) / OSM_TILE_SIZE);
  const startTileY = Math.floor(startY / OSM_TILE_SIZE);
  const endTileY = Math.floor((startY + OSM_VIEW_HEIGHT) / OSM_TILE_SIZE);
  for (let x = startTileX; x <= endTileX; x += 1) {
    for (let y = startTileY; y <= endTileY; y += 1) {
      if (y < 0 || y > maxTile) continue;
      const wrappedX = ((x % scale) + scale) % scale;
      tiles.push({
        key: `${zoom}-${wrappedX}-${y}`,
        src: `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${y}.png`,
        left: ((x * OSM_TILE_SIZE - startX) / OSM_VIEW_WIDTH) * 100,
        top: ((y * OSM_TILE_SIZE - startY) / OSM_VIEW_HEIGHT) * 100,
        width: (OSM_TILE_SIZE / OSM_VIEW_WIDTH) * 100,
        height: (OSM_TILE_SIZE / OSM_VIEW_HEIGHT) * 100,
      });
    }
  }
  const rawPositions = points.map(({ row, point }) => ({
    row,
    left: ((point.x - startX) / OSM_VIEW_WIDTH) * 100,
    top: ((point.y - startY) / OSM_VIEW_HEIGHT) * 100,
  }));
  const collisionGroups = [];
  rawPositions
    .slice()
    .sort((a, b) => a.left - b.left || a.top - b.top)
    .forEach((position) => {
      const group = collisionGroups.find((items) => items.some((item) => Math.hypot(item.left - position.left, item.top - position.top) < 1.45));
      if (group) group.push(position);
      else collisionGroups.push([position]);
    });
  const pointPositions = new Map();
  collisionGroups.forEach((group) => {
    if (group.length === 1) {
      const item = group[0];
      pointPositions.set(item.row, {
        left: Math.max(-8, Math.min(108, item.left)),
        top: Math.max(-8, Math.min(108, item.top)),
        collisionAdjusted: false,
      });
      return;
    }
    const centerLeft = group.reduce((sum, item) => sum + item.left, 0) / group.length;
    const centerTop = group.reduce((sum, item) => sum + item.top, 0) / group.length;
    const radius = Math.min(6.8, 1.8 + (group.length * 0.22));
    group
      .slice()
      .sort((a, b) => text(a.row?.label || a.row?.row?.asset_name || a.row?.row?.center_name).localeCompare(text(b.row?.label || b.row?.row?.asset_name || b.row?.row?.center_name), 'ko'))
      .forEach((item, index) => {
        const angle = ((Math.PI * 2) * index) / group.length - (Math.PI / 2);
        pointPositions.set(item.row, {
          left: clampPercent(centerLeft + (Math.cos(angle) * radius)),
          top: clampPercent(centerTop + (Math.sin(angle) * radius)),
          collisionAdjusted: true,
        });
      });
  });
  const hasClusterRows = rawPositions.some((item) => item.row?.isCluster);
  const spreadedPositions = spreadPercentPositions(
    Array.from(pointPositions.entries()).map(([row, position]) => ({ row, ...position })),
    hasClusterRows ? 18.5 : 3.6,
    hasClusterRows
      ? { leftMin: 8, leftMax: 92, topMin: 12, topMax: 88 }
      : { leftMin: 2, leftMax: 98, topMin: 3, topMax: 97 },
  );
  pointPositions.clear();
  spreadedPositions.forEach((item) => {
    pointPositions.set(item.row, {
      left: item.left,
      top: item.top,
      collisionAdjusted: Boolean(item.collisionAdjusted),
    });
  });
  return { zoom, tiles, pointPositions };
}

function visibleMapTileCoverage(container) {
  if (!container || typeof window === 'undefined') return { count: 0, coverage: 0 };
  const containerRect = container.getBoundingClientRect();
  const containerArea = Math.max(1, containerRect.width * containerRect.height);
  const candidates = Array.from(container.querySelectorAll('img[src], canvas, [style*="background-image"], .leaflet-tile, [data-qa-fake-naver-tile="true"]'));
  const tiles = candidates.filter((element) => {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    const src = element.getAttribute('src') || '';
    const background = style.backgroundImage || element.style.backgroundImage || '';
    const className = typeof element.className === 'string' ? element.className : '';
    const hasRasterTile = element.tagName === 'IMG'
      || element.tagName === 'CANVAS'
      || element.getAttribute('data-qa-fake-naver-tile') === 'true'
      || /url\(/iu.test(background);
    const looksLikeControl = /marker|pin|sprite|logo|control|zoom|scale|dot\.gif|blank|transparent/iu.test(`${src} ${background} ${className}`);
    const overlapWidth = Math.max(0, Math.min(rect.right, containerRect.right) - Math.max(rect.left, containerRect.left));
    const overlapHeight = Math.max(0, Math.min(rect.bottom, containerRect.bottom) - Math.max(rect.top, containerRect.top));
    return hasRasterTile
      && !looksLikeControl
      && rect.width >= 96
      && rect.height >= 96
      && overlapWidth >= 96
      && overlapHeight >= 96
      && style.display !== 'none'
      && style.visibility !== 'hidden'
      && Number(style.opacity || 1) > 0.05;
  });
  const coveredArea = tiles.reduce((sum, element) => {
    const rect = element.getBoundingClientRect();
    const overlapWidth = Math.max(0, Math.min(rect.right, containerRect.right) - Math.max(rect.left, containerRect.left));
    const overlapHeight = Math.max(0, Math.min(rect.bottom, containerRect.bottom) - Math.max(rect.top, containerRect.top));
    return sum + (overlapWidth * overlapHeight);
  }, 0);
  return {
    count: tiles.length,
    coverage: Math.min(1, coveredArea / containerArea),
  };
}

function hasSufficientVisibleMapTiles(container) {
  const stats = visibleMapTileCoverage(container);
  return stats.count >= 3 && stats.coverage >= 0.65;
}

const NAVER_MAP_AUTH_FAILURE_RE = /네이버\s*지도\s*Open\s*API\s*인증|Open API 인증|인증.*실패|unauthorized|authentication|forbidden|invalid\s*client/iu;

function hasNaverMapAuthFailure(container) {
  if (!container) return false;
  return NAVER_MAP_AUTH_FAILURE_RE.test(String(container.textContent || ''));
}

function escapeMapHtml(value) {
  return String(value ?? '')
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&#39;');
}

function buildMarketMapCalloutHtml(item, index) {
  const label = escapeMapHtml(item?.label || item?.regionLabel || `자산 ${index + 1}`);
  const region = escapeMapHtml(item?.regionLabel || '');
  const address = escapeMapHtml(item?.address || item?.coordinateAddress || '');
  return `
    <div class="logistics-map-callout-wrap logistics-map-callout-wrap--centered">
      <button type="button" class="logistics-map-callout" data-map-point-callout="true">
        <strong>${label}</strong>
        <span>${[region, address].filter(Boolean).join(' · ')}</span>
      </button>
    </div>
  `;
}

function MarketMapPanel({
  title,
  rows,
  labelKey = 'asset_name',
  regionKey = 'region',
  onSelect,
  showLargeButton = true,
  mapHeightClass = 'h-[520px]',
  initialSelectedRegion = '',
  initialZoom = 8,
}) {
  const sourceRows = useMemo(() => safeArray(rows), [rows]);
  const mapCanvasRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const mapProviderRef = useRef('');
  const mapZoomListenerRef = useRef(null);
  const markersRef = useRef([]);
  const cadastralLayerRef = useRef(null);
  const onSelectRef = useRef(onSelect);
  const openMapItemRef = useRef(null);
  const fittedRegionRef = useRef('');
  const [mapStatus, setMapStatus] = useState({ status: 'checking', message: '지도 설정 확인 중' });
  const [mapDisplayType, setMapDisplayType] = useState('normal');
  const [geocodedCoords, setGeocodedCoords] = useState({});
  const [geocodeFailures, setGeocodeFailures] = useState({});
  const geocodePendingRef = useRef({});
  const [selectedMapRegion, setSelectedMapRegion] = useState(initialSelectedRegion || '');
  const [mapZoom, setMapZoom] = useState(initialZoom || 8);
  const [forceOsm, setForceOsm] = useState(false);
  const [largeMapOpen, setLargeMapOpen] = useState(false);
  const isRegionMode = !selectedMapRegion;
  const detailPointLimit = 120;
  const clusterScale = Math.max(0.95, Math.min(1.28, 0.95 + (Number(mapZoom || 8) - 7) * 0.055));
  const clusterSize = 56;
  const clusterAnchor = Math.round(clusterSize / 2);
  const applyMapZoom = (nextZoom, options = {}) => {
    const regionModeForZoom = typeof options.regionMode === 'boolean' ? options.regionMode : isRegionMode;
    const minZoom = regionModeForZoom ? 6 : 9;
    const maxZoom = regionModeForZoom ? 12 : 18;
    const normalizedZoom = Math.max(minZoom, Math.min(maxZoom, Number(nextZoom) || mapZoom || 8));
    setMapZoom(normalizedZoom);
    const map = mapInstanceRef.current;
    if (mapProviderRef.current === 'naver' && map && typeof map.setZoom === 'function') {
      try {
        map.setZoom(normalizedZoom, false);
      } catch {
        // Zoom state still updates the next marker redraw.
      }
      try {
        window.naver?.maps?.Event?.trigger?.(map, 'resize');
      } catch {
        // Resize trigger is best effort only.
      }
    }
    if (mapProviderRef.current === 'osm' && map && typeof map.setZoom === 'function') {
      try {
        map.setZoom(normalizedZoom, { animate: false });
      } catch {
        // Zoom state still updates the next marker redraw.
      }
    }
  };
  const applyMapDisplayType = (map, nextType) => {
    if (!map || mapProviderRef.current !== 'naver' || !window.naver?.maps || typeof map.setMapTypeId !== 'function') return;
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
  const handleMapWheel = (event) => {
    if (!mapInstanceRef.current) return;
    if (event.cancelable) {
      event.preventDefault();
    }
    event.stopPropagation();
    const map = mapInstanceRef.current;
    let currentZoom = Number(mapZoom) || (isRegionMode ? 8 : 10);
    if (typeof map.getZoom === 'function') {
      try {
        const providerZoom = Number(map.getZoom());
        if (Number.isFinite(providerZoom)) currentZoom = providerZoom;
      } catch {
        // Use the React state zoom when the provider cannot report its current zoom.
      }
    }
    const delta = Number(event.deltaY) < 0 ? 1 : -1;
    applyMapZoom(currentZoom + delta, { regionMode: isRegionMode });
  };
  const hashPosition = (label, axis) => {
    const code = String(label || '').split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return 18 + ((code * (axis === 'x' ? 17 : 29)) % 64);
  };
  const areaValue = (row) => number(firstText(row.gross_area_py, row.area_py, row.leasable_area_py, row.building_area_py, row.land_area_py, 0));
  const rowLatLng = (row) => {
    const lat = Number(row.latitude ?? row.lat ?? row.y_coord);
    const lng = Number(row.longitude ?? row.lng ?? row.x_coord);
    return Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0 ? [lat, lng] : null;
  };
  const averageLatLng = (rows) => {
    const coords = rows.map(rowLatLng).filter(Boolean);
    if (!coords.length) return null;
    return [
      coords.reduce((sum, pair) => sum + pair[0], 0) / coords.length,
      coords.reduce((sum, pair) => sum + pair[1], 0) / coords.length,
    ];
  };
  const regionRows = useMemo(() => {
    const grouped = new Map();
    sourceRows.forEach((row) => {
      const region = regionValue(row[regionKey]) || '기타';
      const current = grouped.get(region) || { region, regionLabel: regionDisplay(region), count: 0, area: 0, rows: [] };
      current.count += 1;
      current.area += areaValue(row);
      current.rows.push(row);
      grouped.set(region, current);
    });
    const rows = Array.from(grouped.values())
      .sort((a, b) => b.area - a.area || b.count - a.count || a.regionLabel.localeCompare(b.regionLabel, 'ko'))
      .map((item, index) => {
        const center = REGION_CLUSTER_COORDS[item.region]
          || averageLatLng(item.rows)
          || REGION_CENTER_COORDS[item.region]
          || [36.4 + ((index % 5) - 2) * 0.7, 127.8 + ((Math.floor(index / 5) % 4) - 1.5) * 0.9];
        const position = REGION_MAP_POSITIONS[item.region] || [hashPosition(item.region, 'x'), hashPosition(item.region, 'y')];
        return {
          ...item,
          row: item.rows[0] || {},
          index,
          label: item.regionLabel,
          address: '',
          left: position[0],
          top: position[1],
          lat: center[0],
          lng: center[1],
          coordinateSource: 'region.cluster',
          fallback: false,
          isCluster: true,
        };
      });
    return rows;
  }, [sourceRows, regionKey]);
  const selectedRegionRows = useMemo(() => {
    if (!selectedMapRegion) return [];
    return sourceRows
      .filter((row) => regionValue(row[regionKey]) === selectedMapRegion)
      .slice()
      .sort((a, b) => areaValue(b) - areaValue(a) || text(a[labelKey] || a.label).localeCompare(text(b[labelKey] || b.label), 'ko'));
  }, [sourceRows, regionKey, labelKey, selectedMapRegion]);
  const mapRowLimit = isRegionMode ? regionRows.length : detailPointLimit;
  const candidateRows = useMemo(() => (
    isRegionMode
      ? regionRows
      : selectedRegionRows
  ), [isRegionMode, regionRows, selectedRegionRows]);
  const visibleRows = useMemo(() => candidateRows.slice(0, mapRowLimit), [candidateRows, mapRowLimit]);
  const excludedCount = Math.max(0, candidateRows.length - visibleRows.length);
  const plotRows = useMemo(() => {
    const rows = visibleRows.map((row, index) => {
      if (row?.isCluster) {
        return {
          row,
          index,
          label: row.label || row.regionLabel,
          region: row.region,
          regionLabel: row.regionLabel,
          address: '',
          addressCandidates: [],
          coordinateSource: row.coordinateSource || 'region.cluster',
          coordinateAddress: '',
          addressRule: '',
          left: Number.isFinite(Number(row.left)) ? Number(row.left) : hashPosition(row.region, 'x'),
          top: Number.isFinite(Number(row.top)) ? Number(row.top) : hashPosition(row.region, 'y'),
          lat: Number(row.lat),
          lng: Number(row.lng),
          geocoded: false,
          fallback: false,
          isCluster: true,
          count: row.count,
          area: row.area,
          rows: row.rows,
        };
      }
      const region = regionValue(row[regionKey]);
      const position = REGION_MAP_POSITIONS[region] || [hashPosition(region || row[labelKey], 'x'), hashPosition(region || row[labelKey], 'y')];
      const xValue = Number(row.x_percent);
      const yValue = Number(row.y_percent);
      const addressCandidates = Array.from(new Set([
        text(row.address, ''),
        text(row.legal_address, ''),
        text(row.generated_address, ''),
      ].filter(Boolean)));
      const address = addressCandidates[0] || '';
      const geocoded = addressCandidates
        .map((candidate) => geocodedCoords[candidate])
        .find((candidate) => candidate && Number.isFinite(candidate.lat) && Number.isFinite(candidate.lng));
      const rawLat = Number(row.latitude ?? row.lat ?? row.y_coord);
      const rawLng = Number(row.longitude ?? row.lng ?? row.x_coord);
      const hasRawCoords = Number.isFinite(rawLat) && Number.isFinite(rawLng) && rawLat !== 0 && rawLng !== 0;
      const hasGeocodedCoords = Boolean(geocoded && Number.isFinite(geocoded.lat) && Number.isFinite(geocoded.lng));
      const coordinateSource = hasRawCoords
        ? text(row.coordinate_source || 'server.coordinates')
        : (hasGeocodedCoords ? 'client.naver.geocode' : text(row.coordinate_source));
      const regionCenter = REGION_CENTER_COORDS[region];
      const offsetLat = ((index % 7) - 3) * 0.008;
      const offsetLng = ((Math.floor(index / 7) % 7) - 3) * 0.01;
      return {
        row,
        index,
        label: text(row[labelKey] || row.label),
        region,
        regionLabel: regionDisplay(region),
        address,
        addressCandidates,
        coordinateSource,
        coordinateAddress: text(row.coordinate_address),
        addressRule: text(row.address_rule),
        left: Number.isFinite(xValue) ? xValue : Math.max(8, Math.min(92, position[0] + ((index % 5) - 2) * 2.3)),
        top: Number.isFinite(yValue) ? yValue : Math.max(8, Math.min(90, position[1] + ((Math.floor(index / 5) % 5) - 2) * 2.2)),
        lat: hasRawCoords ? rawLat : (hasGeocodedCoords ? geocoded.lat : (regionCenter ? regionCenter[0] + offsetLat : null)),
        lng: hasRawCoords ? rawLng : (hasGeocodedCoords ? geocoded.lng : (regionCenter ? regionCenter[1] + offsetLng : null)),
        geocoded: !hasRawCoords && hasGeocodedCoords,
        fallback: !(hasRawCoords || hasGeocodedCoords),
      };
    });
    if (isRegionMode) return rows;
    const spreadedRows = spreadPercentPositions(
      rows,
      3.6,
      { leftMin: 2, leftMax: 98, topMin: 3, topMax: 97 },
    );
    return rows.map((row, index) => ({
      ...row,
      left: spreadedRows[index]?.left ?? row.left,
      top: spreadedRows[index]?.top ?? row.top,
    }));
  }, [visibleRows, regionKey, labelKey, geocodedCoords, isRegionMode]);
  const markerRows = useMemo(() => (
    plotRows.filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng))
  ), [plotRows]);
  const missingCoordinateCount = plotRows.filter((item) => item.fallback).length;
  const osmZoom = selectedMapRegion ? Math.max(9, Math.min(13, mapZoom)) : Math.max(7, Math.min(12, mapZoom));
  const osmLayout = useMemo(() => buildOsmTileLayout(markerRows, osmZoom), [markerRows, osmZoom]);
  const mapPointStyle = (item) => {
    const osmPosition = mapStatus.status === 'osm' ? osmLayout.pointPositions.get(item) : null;
    return {
      left: `${Number.isFinite(osmPosition?.left) ? osmPosition.left : item.left}%`,
      top: `${Number.isFinite(osmPosition?.top) ? osmPosition.top : item.top}%`,
    };
  };
  const openMapItem = (item) => {
    if (item?.isCluster) {
      fittedRegionRef.current = '';
      setSelectedMapRegion(item.region);
      return;
    }
    onSelectRef.current?.(item.row);
  };
  const clusterLabelParts = useCallback((item) => {
    const parts = regionDisplayParts(item.region);
    const scopeLabel = parts.scope ? `(${parts.scope})` : '';
    const regionLabel = parts.region || item.regionLabel || item.region;
    const countLabel = `${formatNumber(item.count)}건`;
    return { scopeLabel, regionLabel, countLabel };
  }, []);
  const renderClusterLabel = useCallback((item) => {
    const { scopeLabel, regionLabel, countLabel } = clusterLabelParts(item);
    return (
      <>
        <em>{scopeLabel}</em>
        <b>{regionLabel}</b>
        <strong>{countLabel}</strong>
      </>
    );
  }, [clusterLabelParts]);
  const clusterIconHtml = useCallback((item) => {
    const { scopeLabel, regionLabel, countLabel } = clusterLabelParts(item);
    const ariaLabel = [scopeLabel, regionLabel, countLabel].filter(Boolean).join(' ');
    const regionEvent = `event.stopPropagation();window.dispatchEvent(new CustomEvent('market-map-region-select',{detail:{region:'${encodeURIComponent(item.region)}'}}))`;
    return `
      <button type="button" onclick="${regionEvent}" aria-label="${escapeMapHtml(ariaLabel)}" data-region-cluster-button="true" data-region-key="${encodeURIComponent(item.region)}" data-region-name="${escapeMapHtml(item.regionLabel)}" data-region-point-count="${escapeMapHtml(item.count)}" class="market-map-region-cluster-marker">
        <em>${escapeMapHtml(scopeLabel)}</em>
        <b>${escapeMapHtml(regionLabel)}</b>
        <strong>${escapeMapHtml(countLabel)}</strong>
      </button>
    `;
  }, [clusterLabelParts]);

  useEffect(() => {
    openMapItemRef.current = openMapItem;
  });

  useEffect(() => {
    if (selectedMapRegion && !regionRows.some((row) => row.region === selectedMapRegion)) {
      window.queueMicrotask(() => setSelectedMapRegion(''));
    }
  }, [selectedMapRegion, regionRows]);

  useEffect(() => {
    const handleRegionSelect = (event) => {
      const encodedRegion = String(event?.detail?.region || '');
      if (!encodedRegion) return;
      const region = decodeURIComponent(encodedRegion);
      const item = regionRows.find((row) => row.region === region);
      if (item) openMapItemRef.current?.(item);
    };
    window.addEventListener('market-map-region-select', handleRegionSelect);
    return () => window.removeEventListener('market-map-region-select', handleRegionSelect);
  }, [regionRows]);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    const handleMapRuntimeError = (event) => {
      const message = String(event?.message || event?.error?.message || '');
      if (/Cannot read properties of null \(reading '(?:capitalize|isArray|hasValue|TransitionQueue)'\)|Failed to execute 'removeChild' on 'Node'/u.test(message)) {
        event.preventDefault?.();
        setForceOsm(true);
      }
    };
    window.addEventListener('error', handleMapRuntimeError);
    return () => window.removeEventListener('error', handleMapRuntimeError);
  }, []);

  useEffect(() => {
    const targetMap = new Map();
    plotRows
      .filter((item) => item.fallback && item.addressCandidates?.length)
      .forEach((item) => {
        item.addressCandidates.forEach((candidate) => {
          if (!geocodedCoords[candidate] && !geocodeFailures[candidate] && !geocodePendingRef.current[candidate]) {
            targetMap.set(candidate, candidate);
          }
        });
      });
    const geocodeBatchLimit = selectedMapRegion ? Math.min(120, mapRowLimit) : Math.min(50, mapRowLimit);
    const targets = Array.from(targetMap.values()).slice(0, Math.max(1, geocodeBatchLimit));
    if (!targets.length) return undefined;
    targets.forEach((address) => {
      geocodePendingRef.current[address] = true;
    });
    invoke('naver/geocode-batch', { queries: targets })
      .then((result) => {
        const rows = safeArray(result?.rows || result?.data?.rows);
        const nextCoords = {};
        rows.forEach((row) => {
          const query = text(row.query, '');
          const lat = number(row.latitude ?? row.lat ?? row.y);
          const lng = number(row.longitude ?? row.lng ?? row.x);
          if (query && Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0) {
            nextCoords[query] = {
              lat,
              lng,
              source: text(row.cache_hit ? 'naver.geocode.cache' : 'naver.geocode'),
              address: text(row.road_address || row.jibun_address || query),
            };
          }
        });
        if (Object.keys(nextCoords).length) {
          setGeocodedCoords((current) => ({ ...current, ...nextCoords }));
        }
        const failedTargets = targets.filter((address) => !nextCoords[address]);
        if (failedTargets.length) {
          setGeocodeFailures((current) => {
            const next = { ...current };
            failedTargets.forEach((address) => {
              next[address] = true;
            });
            return next;
          });
        }
      })
      .catch(() => {
        setGeocodeFailures((current) => {
          const next = { ...current };
          targets.forEach((address) => {
            next[address] = true;
          });
          return next;
        });
      })
      .finally(() => {
        targets.forEach((address) => {
          delete geocodePendingRef.current[address];
        });
      });
    return undefined;
  }, [plotRows, geocodedCoords, geocodeFailures, mapRowLimit]);

  useEffect(() => {
    let cancelled = false;
    let naverHealthInterval = null;
    let naverHealthTimeout = null;
    let switchingToOsm = false;
    const clearNaverHealthMonitor = () => {
      if (naverHealthInterval) window.clearInterval(naverHealthInterval);
      if (naverHealthTimeout) window.clearTimeout(naverHealthTimeout);
      naverHealthInterval = null;
      naverHealthTimeout = null;
    };
    const clearMarkers = () => {
      markersRef.current.forEach((marker) => {
        try {
          marker?.setMap?.(null);
        } catch {
          // Naver SDK can throw while detaching an unauthorized marker.
        }
        try {
          marker?.remove?.();
        } catch {
          // Leaflet marker cleanup should not be allowed to blank the app.
        }
      });
      markersRef.current = [];
    };
    const clearZoomListener = () => {
      if (!mapZoomListenerRef.current) return;
      if (mapProviderRef.current === 'naver' && window.naver?.maps?.Event) {
        try {
          window.naver.maps.Event.removeListener(mapZoomListenerRef.current);
        } catch {
          // Ignore provider cleanup errors and keep the React tree alive.
        }
      }
      if (mapProviderRef.current === 'osm' && mapInstanceRef.current?.off) {
        try {
          mapInstanceRef.current.off('zoomend', mapZoomListenerRef.current);
        } catch {
          // Ignore provider cleanup errors and keep the React tree alive.
        }
      }
      mapZoomListenerRef.current = null;
    };
    const destroyCurrentMap = () => {
      clearNaverHealthMonitor();
      clearMarkers();
      clearZoomListener();
      if (cadastralLayerRef.current) {
        try {
          cadastralLayerRef.current.setMap(null);
        } catch {
          // Ignore provider cleanup errors and continue fallback.
        }
      }
      cadastralLayerRef.current = null;
      if (mapProviderRef.current === 'osm' && mapInstanceRef.current?.remove) {
        try {
          mapInstanceRef.current.remove();
        } catch {
          // Ignore provider cleanup errors and continue fallback.
        }
      } else if (mapProviderRef.current === 'naver' && typeof mapInstanceRef.current?.destroy === 'function') {
        try {
          mapInstanceRef.current.destroy();
        } catch {
          // Ignore provider cleanup errors and continue fallback.
        }
      }
      mapInstanceRef.current = null;
      mapProviderRef.current = '';
      fittedRegionRef.current = '';
      if (mapCanvasRef.current) mapCanvasRef.current.innerHTML = '';
    };
    clearMarkers();
    const mappableRows = markerRows.filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng));
    if (!mappableRows.length) {
      window.queueMicrotask(() => {
        if (!cancelled) setMapStatus({ status: 'fallback', message: '지도 API 미설정/좌표 부족 · 권역 기준 표시' });
      });
      return () => {
        cancelled = true;
      };
    }
    const mapMessage = (providerLabel) => (
      mappableRows.some((item) => item.fallback)
        ? `${providerLabel} · 일부 좌표 확인 필요`
        : providerLabel
    );
    const mountLeafletMap = async () => {
      try {
        if (cancelled) return;
        const L = await loadLeafletSdk();
        if (cancelled || !mapCanvasRef.current) return;
        const fitRows = isRegionMode ? mappableRows : mappableRows.filter((item) => !item.isCluster);
        const latLngs = fitRows.map((item) => [Number(item.lat), Number(item.lng)]);
        let map = mapProviderRef.current === 'osm' ? mapInstanceRef.current : null;
        let createdLeafletMap = false;
        if (!map) {
          if (mapProviderRef.current && mapProviderRef.current !== 'osm') destroyCurrentMap();
          if (cancelled || !mapCanvasRef.current) return;
          map = L.map(mapCanvasRef.current, {
            scrollWheelZoom: true,
            zoomControl: false,
            attributionControl: true,
          });
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors',
          }).addTo(map);
          mapProviderRef.current = 'osm';
          mapInstanceRef.current = map;
          createdLeafletMap = true;
        } else {
          clearZoomListener();
          try {
            map.invalidateSize?.();
          } catch {
            // Keep the existing fallback map even if size invalidation is unavailable.
          }
        }
        markersRef.current = mappableRows.map((item) => {
          const clusterOptions = item.isCluster
            ? {
              icon: L.divIcon({
                className: 'market-map-region-cluster-icon',
                html: clusterIconHtml(item),
                iconSize: [clusterSize, clusterSize],
                iconAnchor: [clusterAnchor, clusterAnchor],
              }),
            }
            : {};
          const marker = L.marker([Number(item.lat), Number(item.lng)], {
            title: item.isCluster ? `${item.regionLabel} ${formatNumber(item.count)}` : item.label,
            zIndexOffset: item.isCluster ? 1000 - item.index : 0,
            ...clusterOptions,
          }).addTo(map);
          marker.bindTooltip(item.isCluster ? `${item.regionLabel} ${formatNumber(item.count)}` : buildMarketMapCalloutHtml(item, item.index), {
            direction: 'top',
            offset: [0, item.isCluster ? -16 : -18],
            opacity: 1,
            sticky: false,
            interactive: !item.isCluster,
            className: item.isCluster ? 'market-map-region-cluster-tooltip' : 'logistics-map-tooltip',
          });
          if (!item.isCluster) {
            marker.on('click', () => {
              openMapItemRef.current?.(item);
            });
          }
          return marker;
        });
        const shouldFitRegionMode = isRegionMode && (createdLeafletMap || fittedRegionRef.current !== '__regions__');
        const shouldFitSelectedRegion = Boolean(selectedMapRegion && (createdLeafletMap || fittedRegionRef.current !== selectedMapRegion));
        if (isRegionMode) {
          if (shouldFitRegionMode) {
            map.setView(REGION_OVERVIEW_CENTER, REGION_OVERVIEW_ZOOM, { animate: false });
            fittedRegionRef.current = '__regions__';
          }
        } else if (shouldFitSelectedRegion && latLngs.length > 1) {
          map.fitBounds(latLngs, { padding: [34, 34], animate: false });
          fittedRegionRef.current = selectedMapRegion;
        } else if (shouldFitSelectedRegion && latLngs.length) {
          map.setView(latLngs[0], Math.max(10, Math.min(13, mapZoom || 11)), { animate: false });
          fittedRegionRef.current = selectedMapRegion;
        }
        const zoomListener = () => {
          const nextZoom = Number(map.getZoom?.());
          if (Number.isFinite(nextZoom)) setMapZoom(nextZoom);
        };
        map.on('zoomend', zoomListener);
        mapZoomListenerRef.current = zoomListener;
        setMapStatus({ status: 'osm', message: mapMessage('OpenStreetMap') });
        [80, 300, 800].forEach((delay) => window.setTimeout(() => {
          if (!cancelled && mapInstanceRef.current?.invalidateSize) mapInstanceRef.current.invalidateSize();
        }, delay));
      } catch {
        if (!cancelled) {
          destroyCurrentMap();
          mapProviderRef.current = 'osm';
          setMapStatus({ status: 'osm', message: mapMessage('OpenStreetMap') });
        }
      }
    };
    const refreshNaverMap = (map) => {
      if (!map || mapProviderRef.current !== 'naver') return;
      const target = mapCanvasRef.current;
      if (target) {
        target.style.setProperty('position', 'absolute', 'important');
        target.style.setProperty('inset', '0px', 'important');
        target.style.setProperty('width', '100%', 'important');
        target.style.setProperty('height', '100%', 'important');
        target.style.setProperty('min-height', '100%', 'important');
        target.style.setProperty('overflow', 'hidden', 'important');
      }
      const rect = target?.getBoundingClientRect?.();
      const width = Math.max(1, Math.round(rect?.width || mapCanvasRef.current?.clientWidth || 0));
      const height = Math.max(1, Math.round(rect?.height || mapCanvasRef.current?.clientHeight || 0));
      if (width > 1 && height > 1 && typeof map.setSize === 'function' && window.naver?.maps?.Size) {
        try {
          map.setSize(new window.naver.maps.Size(width, height));
        } catch {
          // Some Naver SDK builds do not expose setSize consistently.
        }
      }
      try {
        map.refresh?.();
      } catch {
        // Naver may throw while refreshing a hidden or detached map container.
      }
      try {
        window.naver?.maps?.Event?.trigger?.(map, 'resize');
      } catch {
        // Resize trigger is best effort only.
      }
    };
    const waitForMapCanvasSize = async () => {
      for (let attempt = 0; attempt < 45; attempt += 1) {
        const target = mapCanvasRef.current;
        if (target) {
          target.style.setProperty('position', 'absolute', 'important');
          target.style.setProperty('inset', '0px', 'important');
          target.style.setProperty('width', '100%', 'important');
          target.style.setProperty('height', '100%', 'important');
          target.style.setProperty('min-height', '100%', 'important');
          target.style.setProperty('overflow', 'hidden', 'important');
        }
        const rect = target?.getBoundingClientRect?.();
        if (rect?.width >= 240 && rect?.height >= 240) return true;
        await new Promise((resolve) => window.requestAnimationFrame(resolve));
      }
      return false;
    };
    const switchToLeafletBecauseNaverFailed = async (reason) => {
      if (cancelled || switchingToOsm) return;
      switchingToOsm = true;
      clearNaverHealthMonitor();
      setForceOsm(true);
      setMapStatus({ status: 'checking', message: `Naver Maps ${reason} · OpenStreetMap 전환 중` });
      await mountLeafletMap();
      switchingToOsm = false;
    };
    const startNaverHealthMonitor = (map) => {
      clearNaverHealthMonitor();
      const startedAt = Date.now();
      naverHealthInterval = window.setInterval(() => {
        if (cancelled || mapProviderRef.current !== 'naver' || !mapCanvasRef.current) {
          clearNaverHealthMonitor();
          return;
        }
        refreshNaverMap(map);
        const failedByText = hasNaverMapAuthFailure(mapCanvasRef.current);
        const stats = visibleMapTileCoverage(mapCanvasRef.current);
        const healthyTiles = stats.count >= 2 && stats.coverage >= 0.45;
        if (failedByText) {
          switchToLeafletBecauseNaverFailed('인증 실패 감지');
          return;
        }
        if (healthyTiles) {
          clearNaverHealthMonitor();
          setMapStatus({ status: 'ready', message: mapMessage('Naver Maps') });
          return;
        }
        if (Date.now() - startedAt > 3200) {
          switchToLeafletBecauseNaverFailed('타일 확인 실패');
        }
      }, 360);
      naverHealthTimeout = window.setTimeout(() => {
        if (!cancelled && mapProviderRef.current === 'naver' && !hasNaverMapAuthFailure(mapCanvasRef.current) && hasSufficientVisibleMapTiles(mapCanvasRef.current)) {
          setMapStatus({ status: 'ready', message: mapMessage('Naver Maps') });
        }
        clearNaverHealthMonitor();
      }, 9000);
    };
    const ensureNaverMaps = async () => {
      try {
        if (forceOsm) {
          await mountLeafletMap();
          return;
        }
        setMapStatus({ status: 'checking', message: 'Naver Maps SDK 로딩 중' });
        const clientId = await getNaverMapsClientId();
        if (!clientId) {
          if (!cancelled) await mountLeafletMap();
          return;
        }
        await loadSharedNaverMapsSdk(clientId);
        if (cancelled || !mapCanvasRef.current || !window.naver?.maps) return;
        const hasStableSize = await waitForMapCanvasSize();
        if (cancelled || !hasStableSize || !mapCanvasRef.current) return;
        if (mapProviderRef.current && mapProviderRef.current !== 'naver') destroyCurrentMap();
        const fitRows = isRegionMode ? mappableRows : mappableRows.filter((item) => !item.isCluster);
        const centerRows = fitRows.length ? fitRows : mappableRows;
        const centerLat = centerRows.reduce((sum, item) => sum + Number(item.lat), 0) / Math.max(1, centerRows.length);
        const centerLng = centerRows.reduce((sum, item) => sum + Number(item.lng), 0) / Math.max(1, centerRows.length);
        const center = new window.naver.maps.LatLng(centerLat, centerLng);
        let map = mapInstanceRef.current;
        const createdNaverMap = !map;
        if (!map) {
          map = new window.naver.maps.Map(mapCanvasRef.current, {
            center,
            zoom: selectedMapRegion ? Math.max(10, mapZoom) : Math.max(6, Math.min(9, mapZoom)),
            minZoom: 6,
            background: '#151515',
          });
        }
        mapInstanceRef.current = map;
        mapProviderRef.current = 'naver';
        applyMapDisplayType(map, mapDisplayType);
        clearZoomListener();
        mapZoomListenerRef.current = window.naver.maps.Event.addListener(map, 'zoom_changed', () => {
          const nextZoom = Number(map.getZoom?.());
          if (Number.isFinite(nextZoom)) setMapZoom(nextZoom);
        });
        markersRef.current = mappableRows.map((item) => {
          const markerOptions = {
            position: new window.naver.maps.LatLng(item.lat, item.lng),
            map,
            zIndex: item.isCluster ? 1000 - item.index : 0,
            title: item.isCluster
              ? `${item.regionLabel} · ${formatNumber(item.count)}건 · ${formatNumber(item.area, 1)}평`
              : `${item.label} · ${item.regionLabel}${item.fallback ? ' · 권역 기준' : (item.geocoded ? ' · 주소 좌표' : '')}`,
          };
          if (item.isCluster) {
            markerOptions.icon = {
              content: clusterIconHtml(item),
              size: new window.naver.maps.Size(clusterSize, clusterSize),
              anchor: new window.naver.maps.Point(clusterAnchor, clusterAnchor),
            };
          }
          const marker = new window.naver.maps.Marker(markerOptions);
          if (item.isCluster) {
            window.naver.maps.Event.addListener(marker, 'click', () => {
              openMapItemRef.current?.(item);
            });
          } else {
            window.naver.maps.Event.addListener(marker, 'click', () => {
              openMapItemRef.current?.(item);
            });
          }
          if (!item.isCluster) {
            const infoWindow = new window.naver.maps.InfoWindow({
              content: buildMarketMapCalloutHtml(item, item.index),
              backgroundColor: 'transparent',
              borderColor: 'transparent',
              borderWidth: 0,
              disableAnchor: true,
              anchorSize: new window.naver.maps.Size(0, 0),
              pixelOffset: new window.naver.maps.Point(0, -30),
            });
            let closeTimer = null;
            window.naver.maps.Event.addListener(marker, 'mouseover', () => {
              if (closeTimer) window.clearTimeout(closeTimer);
              infoWindow.open(map, marker);
            });
            window.naver.maps.Event.addListener(marker, 'mouseout', () => {
              closeTimer = window.setTimeout(() => infoWindow.close(), 450);
            });
          }
          return marker;
        });
        let fittedCenter = center;
        const shouldFitRegionMode = isRegionMode && (createdNaverMap || fittedRegionRef.current !== '__regions__');
        const shouldFitSelectedRegion = Boolean(selectedMapRegion && (createdNaverMap || fittedRegionRef.current !== selectedMapRegion));
        if (isRegionMode) {
          if (shouldFitRegionMode) {
            fittedCenter = new window.naver.maps.LatLng(REGION_OVERVIEW_CENTER[0], REGION_OVERVIEW_CENTER[1]);
            map.setCenter(fittedCenter);
            map.setZoom(REGION_OVERVIEW_ZOOM, false);
            fittedRegionRef.current = '__regions__';
          }
        } else if (shouldFitSelectedRegion && fitRows.length > 1 && window.naver.maps.LatLngBounds && typeof map.fitBounds === 'function') {
          try {
            const bounds = new window.naver.maps.LatLngBounds(
              new window.naver.maps.LatLng(fitRows[0].lat, fitRows[0].lng),
              new window.naver.maps.LatLng(fitRows[0].lat, fitRows[0].lng),
            );
            fitRows.forEach((item) => bounds.extend(new window.naver.maps.LatLng(item.lat, item.lng)));
            map.fitBounds(bounds, 34);
            fittedCenter = bounds.getCenter?.() || center;
            fittedRegionRef.current = selectedMapRegion;
          } catch {
            map.setCenter(center);
          }
        } else if (shouldFitSelectedRegion) {
          map.setCenter(center);
          map.setZoom(Math.max(10, Math.min(13, mapZoom || 11)), false);
          fittedRegionRef.current = selectedMapRegion;
        }
        refreshNaverMap(map);
        window.requestAnimationFrame(() => {
          const nextZoom = Number(map.getZoom?.());
          if (!cancelled && Number.isFinite(nextZoom)) setMapZoom(nextZoom);
        });
        setMapStatus({ status: 'ready', message: mapMessage('Naver Maps') });
        startNaverHealthMonitor(map);
        [80, 260].forEach((delay) => window.setTimeout(() => {
          if (!cancelled && mapProviderRef.current === 'naver' && !forceOsm) {
            refreshNaverMap(map);
          }
        }, delay));
      } catch {
        if (!cancelled) await mountLeafletMap();
      }
    };
    ensureNaverMaps();
    return () => {
      cancelled = true;
      clearNaverHealthMonitor();
      clearMarkers();
      clearZoomListener();
      if (cadastralLayerRef.current) {
        try {
          cadastralLayerRef.current.setMap(null);
        } catch {
          // Ignore provider cleanup errors and keep the React tree alive.
        }
      }
      cadastralLayerRef.current = null;
    };
  }, [markerRows, selectedMapRegion, forceOsm, clusterIconHtml]);

  useEffect(() => {
    applyMapDisplayType(mapInstanceRef.current, mapDisplayType);
  }, [mapDisplayType]);

  return (
    <div className={`${INNER} p-4`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-[14px] font-semibold text-white">{title}</div>
        {showLargeButton ? (
          <button
            type="button"
            data-testid="market-map-expand-button"
            onClick={() => setLargeMapOpen(true)}
            className="h-9 rounded-[8px] bg-white px-3 text-[12px] font-semibold text-[#1F1F1E] hover:bg-[#E5E5E5]"
          >
            지도 크게 보기
          </button>
        ) : null}
      </div>
      <div
        className={`relative ${mapHeightClass} overflow-hidden rounded-[12px] border border-[#333333] bg-[#151515]`}
        aria-label={`${title} 지도`}
        data-testid="market-map-panel"
        data-map-mode={isRegionMode ? 'regions' : 'points'}
        data-map-selected-region={selectedMapRegion}
        data-map-region-cluster-count={isRegionMode ? markerRows.filter((item) => item.isCluster).length : 0}
        data-map-visible-asset-count={isRegionMode ? sourceRows.length : visibleRows.length}
        data-map-provider={mapStatus.status === 'ready' ? 'naver' : (mapStatus.status === 'osm' ? 'osm' : 'fallback')}
        data-naver-map-ready={mapStatus.status === 'ready' ? 'true' : 'false'}
        data-osm-map-ready={mapStatus.status === 'osm' ? 'true' : 'false'}
        data-map-fallback-ready={mapStatus.status === 'fallback' ? 'true' : 'false'}
        data-map-point-count={markerRows.filter((item) => !item.isCluster).length}
        data-map-native-marker-count={markerRows.length}
        data-map-coordinate-count={markerRows.length}
        data-map-fallback-count={markerRows.filter((item) => item.fallback).length}
        data-map-missing-coordinate-count={missingCoordinateCount}
        data-map-geocoded-count={markerRows.filter((item) => item.geocoded).length}
        data-map-coordinate-source-count={markerRows.filter((item) => item.coordinateSource).length}
        data-map-excluded-count={excludedCount}
        data-map-zoom={mapZoom}
        onWheel={handleMapWheel}
        style={{
          '--market-cluster-size': `${clusterSize}px`,
          '--market-cluster-visual-scale': `${clusterScale}`,
          '--market-cluster-scope-size': `${Math.max(8, Math.round(9.4 * clusterScale))}px`,
          '--market-cluster-region-size': `${Math.max(12, Math.round(14.2 * clusterScale))}px`,
          '--market-cluster-count-size': `${Math.max(7, Math.round(8.2 * clusterScale))}px`,
        }}
      >
        <div
          ref={mapCanvasRef}
          className="absolute inset-0 logistics-map-canvas [&_img]:!max-w-none [&_*]:box-content"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', minHeight: '100%', overflow: 'hidden' }}
          aria-hidden="true"
        />
        <style>{`
          .market-map-region-cluster-icon {
            background: transparent !important;
            border: 0 !important;
          }
          .market-map-region-cluster-marker {
            box-sizing: border-box !important;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 0;
            width: var(--market-cluster-size, 46px);
            height: var(--market-cluster-size, 46px);
            border-radius: 999px;
            border: 1px solid rgba(150, 205, 245, 0.58);
            background: rgba(8, 68, 108, 0.82);
            color: #fff;
            font: inherit;
            line-height: 1;
            scale: var(--market-cluster-visual-scale, 1);
            box-shadow: 0 8px 18px rgba(0, 0, 0, 0.30);
            cursor: pointer;
            pointer-events: auto !important;
            text-align: center;
            padding: 6px 5px 5px;
          }
          .market-map-region-cluster-marker em,
          .market-map-region-cluster-marker b,
          .market-map-region-cluster-marker strong {
            display: block;
            max-width: calc(var(--market-cluster-size, 52px) - 8px);
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          .market-map-region-cluster-marker em,
          .market-map-region-cluster-marker b {
            font-style: normal;
          }
          .market-map-region-cluster-marker em {
            color: rgba(236, 242, 247, 0.82);
            font-size: var(--market-cluster-scope-size, 7px);
            line-height: 1.02;
            font-weight: 700;
            margin-bottom: 0;
          }
          .market-map-region-cluster-marker b {
            font-size: var(--market-cluster-region-size, 10px);
            line-height: 1.02;
            font-weight: 800;
          }
          .market-map-region-cluster-marker strong {
            margin-top: 2px;
            color: rgba(196, 207, 216, 0.72);
            font-size: var(--market-cluster-count-size, 7px);
            line-height: 1;
            font-weight: 700;
          }
          .market-map-region-cluster-tooltip {
            border: 0 !important;
            border-radius: 999px !important;
            background: rgba(31, 31, 30, 0.92) !important;
            color: #fff !important;
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.24) !important;
            padding: 5px 8px !important;
            font-size: 11px !important;
            font-weight: 700 !important;
          }
          .market-map-region-cluster-tooltip::before {
            display: none !important;
          }
          .logistics-map-tooltip {
            border: 0 !important;
            background: transparent !important;
            box-shadow: none !important;
            padding: 0 !important;
          }
          .logistics-map-tooltip::before {
            display: none !important;
          }
          .logistics-map-tooltip,
          .logistics-map-tooltip * {
            box-sizing: border-box !important;
          }
          .logistics-map-callout-wrap {
            display: block;
            pointer-events: auto;
          }
          .logistics-map-callout-wrap--centered {
            transform: translateX(-50%);
          }
          .logistics-map-callout {
            display: block;
            min-width: 220px;
            max-width: min(320px, calc(100vw - 48px));
            width: max-content;
            border: 0;
            outline: 0;
            border-radius: 8px;
            background: #fff;
            color: #111;
            padding: 10px 12px;
            text-align: left;
            font-size: 12px;
            line-height: 1.45;
            box-shadow: 0 12px 28px rgba(0, 0, 0, 0.18);
            cursor: pointer;
            white-space: nowrap;
          }
          .logistics-map-callout,
          .logistics-map-callout * {
            box-sizing: border-box !important;
          }
          .logistics-map-callout strong {
            display: block;
            margin-bottom: 4px;
            color: #111;
            font-weight: 700;
            white-space: nowrap;
          }
          .logistics-map-callout span {
            display: block;
            color: #111;
            white-space: nowrap;
          }
        `}</style>
        {mapStatus.status === 'osm' ? (
          <div className="pointer-events-none absolute inset-0 z-0" aria-hidden="true">
            {osmLayout.tiles.map((tile) => (
              <img
                key={tile.key}
                src={tile.src}
                alt=""
                className="absolute select-none"
                draggable={false}
                style={{ left: `${tile.left}%`, top: `${tile.top}%`, width: `${tile.width}%`, height: `${tile.height}%` }}
              />
            ))}
            <div className="absolute bottom-2 right-2 rounded-[6px] bg-white/80 px-2 py-1 text-[10px] text-[#1F1F1E]">Map data © OpenStreetMap contributors</div>
          </div>
        ) : null}
        <div className="hidden">
          {[
            ['normal', '일반'],
            ['satellite', '위성'],
            ['cadastral', '지적편집도'],
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
        <MapLayerControl value={mapDisplayType} onChange={setMapDisplayType} data-testid="market-map-layer-control" />
        {selectedMapRegion ? (
          <button
            type="button"
            data-testid="market-map-region-reset"
            onClick={() => {
              setSelectedMapRegion('');
              applyMapZoom(8, { regionMode: true });
            }}
            className="absolute left-3 top-3 z-20 h-8 rounded-[8px] border border-[#3A3A3C] bg-[#1F1F1E]/90 px-3 text-[11px] font-semibold text-white shadow-xl hover:bg-[#30302F]"
          >
            전체 권역
          </button>
        ) : null}
        <div className="absolute left-3 bottom-3 z-10 flex overflow-hidden rounded-[8px] border border-[#3A3A3C] bg-[#1F1F1E]/90">
          <button type="button" data-testid="market-map-zoom-in" onClick={() => applyMapZoom((Number(mapZoom) || 8) + 1)} className="h-8 w-9 text-[15px] font-semibold text-[#E5E5E5] hover:bg-white/[0.06]">+</button>
          <button type="button" data-testid="market-map-zoom-out" onClick={() => applyMapZoom((Number(mapZoom) || 8) - 1)} className="h-8 w-9 border-l border-[#3A3A3C] text-[15px] font-semibold text-[#E5E5E5] hover:bg-white/[0.06]">-</button>
        </div>
        {mapStatus.status !== 'ready' && mapStatus.status !== 'osm' ? (
          <>
            <div className="absolute inset-0 opacity-45" style={{ backgroundImage: 'linear-gradient(#2B2B2D 1px, transparent 1px), linear-gradient(90deg, #2B2B2D 1px, transparent 1px)', backgroundSize: '38px 38px' }} />
            <div className="absolute left-3 top-3 rounded-[8px] border border-[#3A3A3C] bg-[#1F1F1E]/90 px-3 py-2 text-[11px] text-[#FFD479]">
              {mapStatus.message}
            </div>
            {markerRows.map((item) => (
              <button
                key={`loading-point-${item.row.row_key || item.row.id || item.index}`}
                type="button"
                data-map-point-button={item.isCluster ? undefined : 'true'}
                data-region-cluster-button={item.isCluster ? 'true' : undefined}
                data-region-name={item.isCluster ? item.regionLabel : undefined}
                data-region-point-count={item.isCluster ? item.count : undefined}
                title={`${item.label} · ${item.regionLabel}`}
                onClick={() => openMapItem(item)}
                className={item.isCluster
                  ? 'market-map-region-cluster-marker absolute z-10 -translate-x-1/2 -translate-y-1/2'
                  : 'absolute z-10 h-8 w-8 -translate-x-1/2 -translate-y-full rounded-full border border-white bg-[#9AD7FF] text-[11px] font-bold text-[#111] shadow-[0_8px_18px_rgba(0,0,0,0.28)] hover:bg-white'}
                style={mapPointStyle(item)}
              >
                {item.isCluster ? renderClusterLabel(item) : ''}
              </button>
            ))}
          </>
        ) : null}
        {!sourceRows.length ? <div className="absolute inset-0 grid place-items-center text-[13px] text-[#86868B]">표시할 지도 데이터가 없습니다.</div> : null}
      </div>
      {largeMapOpen ? (
        <Modal title={`${title} 크게 보기`} onClose={() => setLargeMapOpen(false)} width="max-w-[calc(100vw-32px)]" fullscreen>
          <MarketMapPanel
            title={title}
            rows={rows}
            labelKey={labelKey}
            regionKey={regionKey}
            onSelect={onSelect}
            showLargeButton={false}
            mapHeightClass="h-[calc(100vh-170px)]"
            initialSelectedRegion={selectedMapRegion}
            initialZoom={mapZoom}
          />
        </Modal>
      ) : null}
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

function BarList({ rows, labelKey = 'label', valueKey = 'value', formatter = formatNumber, maxRows = 10, color = CHART_COLORS.primary, onRowClick = null }) {
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
            data-bar-list-row="true"
            data-bar-list-clickable={onRowClick ? 'true' : 'false'}
            className={`${INNER} px-3 py-2 ${onRowClick ? 'cursor-pointer hover:bg-[#262626]' : ''}`}
            onClick={() => onRowClick?.(row)}
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

function chartSeriesColor(series, index = 0) {
  const label = text(series, '');
  if (/상온|dry|ambient/iu.test(label)) return CHART_COLORS.primary;
  if (/저온|냉장|냉동|cold/iu.test(label)) return CHART_COLORS.secondary;
  if (/수도권/u.test(label)) return CHART_COLORS.primary;
  if (/지방/u.test(label)) return CHART_COLORS.secondary;
  if (/전국/u.test(label)) return CHART_COLORS.warning;
  if (/합계/u.test(label)) return CHART_COLORS.neutral;
  return CHART_SERIES_COLORS[index % CHART_SERIES_COLORS.length];
}

function regionSeriesColor(series, index = 0) {
  const region = regionValue(series);
  return REGION_SERIES_COLORS[region] || CHART_SERIES_COLORS[index % CHART_SERIES_COLORS.length];
}

function sectionedRows(rows, labelKey = 'label') {
  const sections = [
    ['수도권', []],
    ['지방', []],
    ['기타', []],
  ];
  const sectionMap = new Map(sections);
  safeArray(rows).forEach((row) => {
    const scope = regionScopeOf(row.region || row[labelKey]) || '기타';
    sectionMap.get(scope)?.push(row);
  });
  sectionMap.forEach((items) => {
    items.sort((a, b) => {
      const left = REGION_ORDER.indexOf(regionValue(a.region || a[labelKey]));
      const right = REGION_ORDER.indexOf(regionValue(b.region || b[labelKey]));
      if (left !== -1 || right !== -1) return (left === -1 ? 999 : left) - (right === -1 ? 999 : right);
      return text(a[labelKey]).localeCompare(text(b[labelKey]), 'ko');
    });
  });
  return sections.map(([scope, items]) => ({ scope, rows: items })).filter((section) => section.rows.length);
}

function ScopedBarList({ rows, labelKey = 'label', valueKey = 'value', formatter = formatNumber, color = CHART_COLORS.primary, onRowClick = null }) {
  const [hover, setHover] = useState(null);
  const normalizedRows = safeArray(rows)
    .map((row) => ({
      ...row,
      [labelKey]: regionDisplay(row.region || row[labelKey]),
      [valueKey]: number(row[valueKey]),
    }))
    .filter((row) => text(row[labelKey], '') !== '' && Number.isFinite(Number(row[valueKey])));
  const nonZeroRows = normalizedRows.filter((row) => number(row[valueKey]) !== 0);
  const visibleRows = (nonZeroRows.length ? nonZeroRows : normalizedRows)
    .sort((a, b) => {
      const left = REGION_ORDER.indexOf(regionValue(a.region || a[labelKey]));
      const right = REGION_ORDER.indexOf(regionValue(b.region || b[labelKey]));
      if (left !== -1 || right !== -1) return (left === -1 ? 999 : left) - (right === -1 ? 999 : right);
      return text(a[labelKey]).localeCompare(text(b[labelKey]), 'ko');
    });
  const maxValue = Math.max(...visibleRows.map((row) => Math.abs(number(row[valueKey]))), 1);
  return (
    <div className="relative space-y-4" data-chart-role="scoped-bar-list" data-chart-empty={visibleRows.length ? 'false' : 'true'}>
      {visibleRows.length ? sectionedRows(visibleRows, labelKey).map((section) => (
        <div key={section.scope}>
          <div className="mb-2 text-[11px] font-semibold text-[#A1A1AA]">{section.scope}</div>
          <div className="space-y-2">
            {section.rows.map((row) => {
              const value = number(row[valueKey]);
              return (
                <div
                  key={row.id || `${section.scope}-${row[labelKey]}`}
                  data-scoped-bar-row="true"
                  data-scoped-bar-clickable={onRowClick ? 'true' : 'false'}
                  className={`${INNER} px-3 py-2 ${onRowClick ? 'cursor-pointer hover:bg-[#262626]' : ''}`}
                  onClick={() => onRowClick?.(row)}
                  onMouseMove={(event) => setHover({
                    x: event.clientX,
                    y: event.clientY,
                    title: text(row[labelKey]),
                    value: formatter(value),
                    detail: row.count ? `${formatNumber(row.count)}건` : row.metric_label,
                  })}
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
            })}
          </div>
        </div>
      )) : <div className={`${INNER} px-4 py-5 text-center text-[13px] text-[#86868B]`}>표시할 차트 데이터가 없습니다.</div>}
      <ChartTooltip hover={hover} />
    </div>
  );
}

function ScopedGroupedBarChart({ rows, formatter = formatNumber, onRowClick = null }) {
  const [hover, setHover] = useState(null);
  const sourceRows = safeArray(rows)
    .map((row) => ({ ...row, label: regionDisplay(row.region || row.label), series: text(row.series, ''), value: number(row.value) }))
    .filter((row) => text(row.label, '') && text(row.series, '') && Number.isFinite(Number(row.value)));
  const seriesOrder = ['상온(복합포함)', '저온(복합포함)', '상온', '저온', '복합 상온', '복합 저온', '복합 전체'];
  const series = [...new Set(sourceRows.map((row) => text(row.series)))]
    .sort((a, b) => {
      const left = seriesOrder.indexOf(a);
      const right = seriesOrder.indexOf(b);
      if (left !== -1 || right !== -1) return (left === -1 ? 999 : left) - (right === -1 ? 999 : right);
      return a.localeCompare(b, 'ko');
    });
  const maxValue = Math.max(...sourceRows.map((row) => Math.abs(number(row.value))), 1);
  const sections = sectionedRows([...new Set(sourceRows.map((row) => row.label))].map((label) => ({ label })));
  const rowsForLabel = (label, seriesName) => sourceRows.find((row) => text(row.label) === label && text(row.series) === seriesName);
  return (
    <div className="relative space-y-4 rounded-[12px] border border-[#333333] bg-[#171717] p-4" data-chart-role="scoped-grouped-bar" data-chart-empty={sourceRows.length ? 'false' : 'true'}>
      {sourceRows.length ? (
        <>
          <div className="flex flex-wrap gap-3 text-[11px] text-[#A1A1AA]">
            {series.map((item, index) => (
              <span key={item} className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: chartSeriesColor(item, index) }} />
                {item}
              </span>
            ))}
          </div>
          {sections.map((section) => (
            <div key={section.scope}>
              <div className="mb-2 text-[11px] font-semibold text-[#A1A1AA]">{section.scope}</div>
              <div className="space-y-3">
                {section.rows.map(({ label }) => (
                  <div key={label} className="grid grid-cols-[132px_1fr] items-center gap-3">
                    <div className="truncate text-[12px] font-semibold text-white" title={label}>{label}</div>
                    <div className="space-y-1.5">
                      {series.map((item, index) => {
                        const row = rowsForLabel(label, item);
                        const value = number(row?.value);
                        return (
                          <div key={`${label}-${item}`} data-scoped-grouped-bar-row="true" data-scoped-grouped-bar-clickable={row && onRowClick ? 'true' : 'false'} className={`flex items-center gap-2 ${row && onRowClick ? 'cursor-pointer' : ''}`} onClick={() => row && onRowClick?.(row)}>
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#2C2C2E]">
                              <div
                                className="h-full rounded-full"
                                style={{ width: `${row ? Math.max(4, Math.min(100, (Math.abs(value) / maxValue) * 100)) : 0}%`, backgroundColor: chartSeriesColor(item, index) }}
                                onMouseMove={(event) => row && setHover({ x: event.clientX, y: event.clientY, title: `${label} · ${item}`, value: formatter(value), detail: row.metric_label })}
                                onMouseLeave={() => setHover(null)}
                              />
                            </div>
                            <div className="w-[70px] text-right text-[11px] text-[#E5E5E5]">{row ? formatter(value) : '-'}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </>
      ) : <div className="grid h-[220px] place-items-center text-[13px] text-[#86868B]">표시할 차트 데이터가 없습니다.</div>}
      <ChartTooltip hover={hover} />
    </div>
  );
}

function MultiLineChart({
  rows,
  formatter = formatNumber,
  valueLabel = '값',
  onPointClick = null,
  yMin = 0,
  yMax = null,
  yStep = null,
  splitPeriodAxis = false,
  legendAlign = 'start',
  height = 320,
}) {
  const [hover, setHover] = useState(null);
  const [focusedSeries, setFocusedSeries] = useState('');
  const sourceRows = safeArray(rows).filter((row) => text(row.label, '') && text(row.series, '') && Number.isFinite(Number(row.value)));
  const labels = [...new Set(sourceRows.map((row) => text(row.label)))].sort((a, b) => periodSortValue(a) - periodSortValue(b) || a.localeCompare(b, 'ko'));
  const series = [...new Set(sourceRows.map((row) => text(row.series)))];
  const axisMin = Number.isFinite(Number(yMin)) ? Number(yMin) : 0;
  const rawMax = Math.max(...sourceRows.map((row) => number(row.value)), 1);
  const axisMax = Number.isFinite(Number(yMax)) && Number(yMax) > axisMin ? Number(yMax) : rawMax;
  const axisRange = Math.max(1e-9, axisMax - axisMin);
  const tickStep = Number(yStep);
  const width = 1320;
  const chartHeight = Math.max(300, Number(height) || 320);
  const left = 54;
  const right = 8;
  const top = 24;
  const bottom = chartHeight - (splitPeriodAxis ? 78 : 62);
  const xFor = (index) => labels.length <= 1 ? (left + width - right) / 2 : left + (index * (width - left - right)) / (labels.length - 1);
  const yFor = (value) => bottom - ((number(value) - axisMin) / axisRange) * (bottom - top);
  const ticks = Number.isFinite(tickStep) && tickStep > 0
    ? Array.from({ length: Math.floor((axisMax - axisMin) / tickStep) + 1 }, (_, index) => {
      const value = axisMin + tickStep * index;
      return { value, y: yFor(value) };
    })
    : [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({ value: axisMin + axisRange * ratio, y: bottom - ratio * (bottom - top) }));
  const axisParts = labels.map(periodAxisParts);
  const yearSpans = [];
  axisParts.forEach((part, index) => {
    if (!part.year) return;
    const last = yearSpans[yearSpans.length - 1];
    if (last && last.year === part.year && last.end === index - 1) {
      last.end = index;
    } else {
      yearSpans.push({ year: part.year, start: index, end: index });
    }
  });
  return (
    <div className="relative rounded-[12px] border border-[#333333] bg-[#171717] p-4" data-chart-role="multi-line" data-chart-empty={sourceRows.length ? 'false' : 'true'}>
      {sourceRows.length ? (
        <>
          <svg viewBox={`0 0 ${width} ${chartHeight}`} className="w-full overflow-visible" style={{ height: `${chartHeight}px` }}>
            {ticks.map((tick) => (
              <g key={tick.value}>
                <line x1={left} x2={width - right} y1={tick.y} y2={tick.y} stroke="#2C2C2E" strokeWidth="1" />
                <text x={left - 10} y={tick.y + 4} textAnchor="end" fill="#86868B" fontSize="10">{formatter(tick.value)}</text>
              </g>
            ))}
            <line x1={left} x2={left} y1={top} y2={bottom} stroke="#3A3A3C" strokeWidth="1" />
            <line x1={left} x2={width - right} y1={bottom} y2={bottom} stroke="#3A3A3C" strokeWidth="1" />
            {series.map((item, seriesIndex) => {
              const points = labels.map((label, index) => {
                const row = sourceRows.find((candidate) => text(candidate.label) === label && text(candidate.series) === item);
                return row ? [xFor(index), yFor(row.value), row] : null;
              }).filter(Boolean);
              const active = !focusedSeries || focusedSeries === item;
              return (
                <g key={item}>
                  {points.length > 1 ? <polyline points={points.map(([x, y]) => `${x},${y}`).join(' ')} fill="none" stroke={active ? chartSeriesColor(item, seriesIndex) : '#5A5A5E'} strokeWidth="2.5" opacity={active ? 0.95 : 0.38} /> : null}
                  {points.map(([x, y, row]) => (
                    <circle
                      key={`${item}-${row.label}`}
                      cx={x}
                      cy={y}
                      r="4.5"
                      fill={active ? chartSeriesColor(item, seriesIndex) : '#5A5A5E'}
                      opacity={active ? 1 : 0.45}
                      className={onPointClick ? 'cursor-pointer' : ''}
                      onClick={() => onPointClick?.(row)}
                      onMouseMove={(event) => setHover({ x: event.clientX, y: event.clientY, title: `${row.label} · ${item}`, value: formatter(row.value), detail: row.metric_label || valueLabel })}
                      onMouseLeave={() => setHover(null)}
                    />
                  ))}
                </g>
              );
            })}
            {labels.map((label, index) => (
              <text key={label} x={xFor(index)} y={bottom + 24} textAnchor="middle" fill="#A1A1AA" fontSize="10">{splitPeriodAxis ? axisParts[index].sub : label.replace(' ', '\u00A0')}</text>
            ))}
            {splitPeriodAxis ? yearSpans.map((span) => {
              const x = (xFor(span.start) + xFor(span.end)) / 2;
              return <text key={span.year} x={x} y={bottom + 46} textAnchor="middle" fill="#86868B" fontSize="10">{span.year}년</text>;
            }) : null}
          </svg>
          <div className={`flex flex-wrap gap-3 text-[11px] text-[#A1A1AA] ${legendAlign === 'center' ? 'justify-center' : ''}`}>
            {series.map((item, index) => {
              const active = !focusedSeries || focusedSeries === item;
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => setFocusedSeries((current) => current === item ? '' : item)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 transition ${active ? 'border-[#3A3A3C] text-white' : 'border-transparent text-[#86868B] opacity-70'} hover:border-[#5A5A5E] hover:text-white`}
                >
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: active ? chartSeriesColor(item, index) : '#5A5A5E' }} />
                  {item}
                </button>
              );
            })}
          </div>
        </>
      ) : <div className="grid h-[300px] place-items-center text-[13px] text-[#86868B]">표시할 차트 데이터가 없습니다.</div>}
      <ChartTooltip hover={hover} />
    </div>
  );
}

function StackedPeriodBarChart({
  rows,
  formatter = formatKrw,
  axisFormatter = formatKrwAxis,
  onPeriodClick = null,
  axisStep = null,
  legendPosition = 'bottom',
  legendAlign = 'start',
  colorFor = chartSeriesColor,
  height = 310,
  showTotalLabels = false,
}) {
  const [hover, setHover] = useState(null);
  const [focusedSeries, setFocusedSeries] = useState('');
  const sourceRows = safeArray(rows).filter((row) => text(row.label, '') && text(row.series, '') && Number.isFinite(Number(row.value)));
  const periods = [...new Set(sourceRows.map((row) => text(row.label)))].sort((a, b) => Number(a) - Number(b) || a.localeCompare(b, 'ko'));
  const series = [...new Set(sourceRows.map((row) => text(row.series)))];
  const totals = new Map(periods.map((period) => [period, sourceRows.filter((row) => text(row.label) === period).reduce((sum, row) => sum + number(row.value), 0)]));
  const rawMaxValue = Math.max(...totals.values(), 1);
  const numericAxisStep = Number(axisStep);
  const maxValue = Number.isFinite(numericAxisStep) && numericAxisStep > 0
    ? Math.max(numericAxisStep, Math.ceil(rawMaxValue / numericAxisStep) * numericAxisStep)
    : rawMaxValue;
  const width = 1040;
  const chartHeight = Math.max(300, Number(height) || 310);
  const left = legendPosition === 'right' ? 84 : 70;
  const right = 28;
  const top = showTotalLabels ? 48 : 24;
  const bottom = chartHeight - 72;
  const slot = (width - left - right) / Math.max(1, periods.length);
  const barWidth = Math.max(18, Math.min(54, slot * 0.58));
  const xFor = (index) => left + slot * index + slot / 2;
  const yFor = (value) => bottom - (number(value) / maxValue) * (bottom - top);
  const ticks = Number.isFinite(numericAxisStep) && numericAxisStep > 0
    ? Array.from({ length: Math.floor(maxValue / numericAxisStep) + 1 }, (_, index) => {
      const value = numericAxisStep * index;
      const ratio = value / maxValue;
      return { ratio, value, y: bottom - ratio * (bottom - top) };
    })
    : [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({ ratio, value: maxValue * ratio, y: bottom - ratio * (bottom - top) }));
  const legend = (
    <div className={`flex ${legendPosition === 'right' ? 'max-h-[340px] min-w-[178px] flex-col overflow-auto pr-1' : 'flex-wrap'} gap-2 text-[11px] text-[#A1A1AA]`}>
      {series.map((item, index) => {
        const active = !focusedSeries || focusedSeries === item;
        return (
          <button
            key={item}
            type="button"
            onClick={() => setFocusedSeries((current) => (current === item ? '' : item))}
            data-stacked-legend="true"
            data-stacked-legend-active={active ? 'true' : 'false'}
            data-stacked-legend-muted={!active ? 'true' : 'false'}
            className={`inline-flex items-center gap-1.5 rounded-[7px] px-2 py-1 text-left transition ${active ? 'text-white' : 'text-[#86868B] opacity-70'} hover:bg-white/5`}
            title={`${item}만 강조`}
          >
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: active ? colorFor(item, index) : '#5A5A5E' }} />
            <span className="truncate">{item}</span>
          </button>
        );
      })}
    </div>
  );
  return (
    <div className="relative rounded-[12px] border border-[#333333] bg-[#171717] p-4" data-chart-role="stacked-period-bar" data-chart-empty={sourceRows.length ? 'false' : 'true'}>
      {sourceRows.length ? (
        <div className={legendPosition === 'right' ? 'grid grid-cols-[minmax(0,1fr)_190px] items-start gap-4' : ''}>
          <svg viewBox={`0 0 ${width} ${chartHeight}`} className="w-full overflow-visible" style={{ height: `${chartHeight}px` }}>
              {ticks.map((tick) => (
                <g key={tick.value}>
                  <line x1={left} x2={width - right} y1={tick.y} y2={tick.y} stroke="#2C2C2E" strokeWidth="1" />
                  <text x={left - 10} y={tick.y + 4} textAnchor="end" fill="#86868B" fontSize="10">{axisFormatter(tick.value)}</text>
                </g>
              ))}
              <line x1={left} x2={left} y1={top} y2={bottom} stroke="#3A3A3C" strokeWidth="1" />
              <line x1={left} x2={width - right} y1={bottom} y2={bottom} stroke="#3A3A3C" strokeWidth="1" />
              {periods.map((period, periodIndex) => {
                let yCursor = bottom;
                const total = totals.get(period) || 0;
                return (
                  <g key={period} className={onPeriodClick ? 'cursor-pointer' : ''} onClick={() => onPeriodClick?.(period)}>
                    {showTotalLabels ? (
                      <text data-stacked-total-label="true" x={xFor(periodIndex)} y={Math.max(16, yFor(total) - 9)} textAnchor="middle" fill="#E5E5E5" fontSize="10" fontWeight="700">{formatter(total)}</text>
                    ) : null}
                    {series.map((item, seriesIndex) => {
                      const row = sourceRows.find((candidate) => text(candidate.label) === period && text(candidate.series) === item);
                      const value = number(row?.value);
                      const segmentHeight = value ? (value / maxValue) * (bottom - top) : 0;
                      yCursor -= segmentHeight;
                      const active = !focusedSeries || focusedSeries === item;
                      return row ? (
                        <rect
                          key={`${period}-${item}`}
                          data-stacked-bar="true"
                          data-stacked-bar-active={active ? 'true' : 'false'}
                          x={xFor(periodIndex) - barWidth / 2}
                          y={yCursor}
                          width={barWidth}
                          height={Math.max(1, segmentHeight)}
                          fill={active ? colorFor(item, seriesIndex) : '#4A4A4D'}
                          opacity={active ? 0.9 : 0.38}
                          onMouseMove={(event) => setHover({ x: event.clientX, y: event.clientY, title: `${period} · ${item}`, value: formatter(value), detail: row.metric_label })}
                          onMouseLeave={() => setHover(null)}
                        />
                      ) : null;
                    })}
                    <text x={xFor(periodIndex)} y={bottom + 24} textAnchor="middle" fill="#86868B" fontSize="10">{period}</text>
                  </g>
                );
              })}
          </svg>
          {legendPosition === 'right' ? legend : null}
          {legendPosition !== 'right' ? <div className={`mt-2 flex ${legendAlign === 'center' ? 'justify-center' : 'justify-start'}`}>{legend}</div> : null}
        </div>
      ) : <div className="grid h-[300px] place-items-center text-[13px] text-[#86868B]">표시할 차트 데이터가 없습니다.</div>}
      <ChartTooltip hover={hover} />
    </div>
  );
}

function SupplyAreaChart({
  rows,
  seriesType,
  title,
  formatter = (value) => `${formatNumber(value, 0)}평`,
  onPeriodClick = null,
  detailCountForPeriod = null,
  axisTickMode = 'fixed-50000',
}) {
  const [hover, setHover] = useState(null);
  const [focusedSeries, setFocusedSeries] = useState('');
  const sourceRows = safeArray(rows).filter((row) => row.series_type === seriesType && text(row.period_label, '') && Number.isFinite(Number(row.value)));
  const detailRows = sourceRows.filter((row) => !['합계', '전체'].includes(text(row.label)) && row.is_subtotal !== true);
  const stackSourceRows = detailRows.length ? detailRows : sourceRows;
  const normalizedRows = stackSourceRows
    .map((row) => {
      const rawSeries = text(row.region || row.label, '합계');
      const isTotal = ['합계', '전체'].includes(rawSeries);
      return {
        period: text(row.period_label),
        series: isTotal ? '합계' : regionDisplay(rawSeries),
        value: number(row.value),
        metric_label: text(row.metric_label || row.source_label, ''),
      };
    })
    .filter((row) => text(row.period, '') && text(row.series, '') && Number.isFinite(Number(row.value)));
  const knownRows = normalizedRows.filter((row) => !isUnknownPeriodLabel(row.period));
  const unknownRows = normalizedRows.filter((row) => isUnknownPeriodLabel(row.period));
  const periods = [...new Set(knownRows.map((row) => row.period))]
    .sort((a, b) => periodSortValue(a) - periodSortValue(b) || a.localeCompare(b, 'ko'));
  const regionOrderValue = (label) => {
    const compact = compactRegionLabel(label);
    const index = REGION_ORDER.indexOf(compact);
    return index === -1 ? 999 : index;
  };
  const series = [...new Set(knownRows.map((row) => row.series))]
    .sort((a, b) => regionOrderValue(a) - regionOrderValue(b) || a.localeCompare(b, 'ko'));
  const unknownSeries = [...new Set(unknownRows.map((row) => row.series))]
    .sort((a, b) => regionOrderValue(a) - regionOrderValue(b) || a.localeCompare(b, 'ko'));
  const valueFor = (targetPeriod, targetSeries) => knownRows
    .filter((row) => row.period === targetPeriod && row.series === targetSeries)
    .reduce((sum, row) => sum + number(row.value), 0);
  const unknownValueFor = (targetSeries) => unknownRows
    .filter((row) => row.series === targetSeries)
    .reduce((sum, row) => sum + number(row.value), 0);
  const periodTotal = (targetPeriod) => series.reduce((sum, item) => sum + valueFor(targetPeriod, item), 0);
  const knownMax = Math.max(...periods.map(periodTotal), 0);
  const unknownTotal = unknownSeries.reduce((sum, item) => sum + unknownValueFor(item), 0);
  const niceStep = (maxValue, intervals = 4) => {
    const raw = Math.max(1, Number(maxValue) || 0) / Math.max(1, intervals);
    const power = 10 ** Math.floor(Math.log10(raw));
    const multiple = [1, 2, 5, 10].find((item) => item * power >= raw) || 10;
    return multiple * power;
  };
  const axisStep = axisTickMode === 'five-lines' ? niceStep(knownMax, 4) : 50000;
  const axisMax = axisTickMode === 'five-lines'
    ? Math.max(axisStep * 4, axisStep)
    : Math.max(axisStep, Math.ceil(Math.max(knownMax, axisStep) / axisStep) * axisStep);
  const ticks = axisTickMode === 'five-lines'
    ? [0, 1, 2, 3, 4].map((index) => axisStep * index)
    : [];
  if (axisTickMode !== 'five-lines') {
    for (let tick = 0; tick <= axisMax; tick += axisStep) ticks.push(tick);
  }
  const width = 1040;
  const height = 334;
  const left = 80;
  const right = 12;
  const chartTop = 18;
  const chartBottom = 252;
  const plotWidth = width - left - right;
  const bandWidth = periods.length ? plotWidth / periods.length : plotWidth;
  const barWidth = Math.max(16, Math.min(46, bandWidth * 0.54));
  const xFor = (index) => left + (bandWidth * index) + (bandWidth / 2);
  const yFor = (value) => chartBottom - (number(value) / axisMax) * (chartBottom - chartTop);
  const colorFor = (item, index) => item === '합계' ? CHART_COLORS.primary : regionSeriesColor(item, index);
  const displayColorFor = (item, index) => focusedSeries && focusedSeries !== item ? '#4A4A4D' : colorFor(item, index);
  const displayOpacityFor = (item) => focusedSeries && focusedSeries !== item ? 0.42 : 0.92;
  const axisParts = periods.map(periodAxisParts);
  const yearSpans = [];
  axisParts.forEach((part, index) => {
    if (!part.year) return;
    const last = yearSpans[yearSpans.length - 1];
    if (last && last.year === part.year && last.end === index - 1) {
      last.end = index;
    } else {
      yearSpans.push({ year: part.year, start: index, end: index });
    }
  });
  return (
    <div className="relative rounded-[12px] border border-[#333333] bg-[#171717] p-4" data-chart-role="supply-area" data-chart-empty={normalizedRows.length ? 'false' : 'true'} aria-label={title || '공급 면적 차트'}>
      {normalizedRows.length ? (
        <div className={`grid grid-cols-1 gap-3 ${unknownRows.length ? 'xl:grid-cols-[minmax(0,1fr)_460px]' : ''}`}>
          <div className="min-w-0">
            {periods.length ? (
              <svg viewBox={`0 0 ${width} ${height}`} className="w-full overflow-visible" style={{ height: `${height}px` }}>
                {ticks.map((tick) => {
                  const y = yFor(tick);
                  return (
                    <g key={tick}>
                      <line x1={left} x2={width - right} y1={y} y2={y} stroke="#2C2C2E" strokeWidth="1" />
                      <text x={left - 10} y={y + 4} textAnchor="end" fill="#86868B" fontSize="10">{formatter(tick)}</text>
                    </g>
                  );
                })}
                <line x1={left} x2={left} y1={chartTop} y2={chartBottom} stroke="#3A3A3C" strokeWidth="1" />
                <line x1={left} x2={width - right} y1={chartBottom} y2={chartBottom} stroke="#3A3A3C" strokeWidth="1" />
                {periods.map((period, periodIndex) => {
                  let yCursor = chartBottom;
                  const detailCount = typeof detailCountForPeriod === 'function' ? detailCountForPeriod(period, seriesType) : 1;
                  const canOpenDetail = Boolean(onPeriodClick && detailCount > 0);
                  const total = periodTotal(period);
                  return (
                    <g
                      key={period}
                      className={canOpenDetail ? 'cursor-pointer' : ''}
                      data-supply-chart-period-group="true"
                      data-supply-chart-clickable={canOpenDetail ? 'true' : 'false'}
                      onClick={() => canOpenDetail && onPeriodClick?.(period, seriesType)}
                    >
                      {series.map((item, seriesIndex) => {
                        const value = valueFor(period, item);
                        if (!value) return null;
                        const segmentHeight = Math.max(1, (value / axisMax) * (chartBottom - chartTop));
                        yCursor -= segmentHeight;
                        return (
                          <rect
                            key={`${period}-${item}`}
                            x={xFor(periodIndex) - (barWidth / 2)}
                            y={yCursor}
                            width={barWidth}
                            height={segmentHeight}
                            rx="2.5"
                            fill={displayColorFor(item, seriesIndex)}
                            opacity={displayOpacityFor(item)}
                            data-supply-chart-bar="true"
                            data-supply-chart-clickable={canOpenDetail ? 'true' : 'false'}
                            onMouseMove={(event) => setHover({
                              x: event.clientX,
                              y: event.clientY,
                              title: `${period} · ${item}`,
                              value: formatter(value),
                              detail: `합계 ${formatter(periodTotal(period))}`,
                            })}
                            onMouseLeave={() => setHover(null)}
                          />
                        );
                      })}
                      {total ? (
                        <text x={xFor(periodIndex)} y={Math.max(chartTop + 10, yFor(total) - 7)} textAnchor="middle" fill="#E5E7EB" fontSize="10" fontWeight="600">{formatter(total)}</text>
                      ) : null}
                      <text x={xFor(periodIndex)} y={chartBottom + 24} textAnchor="middle" fill="#A1A1AA" fontSize="10">{axisParts[periodIndex].sub}</text>
                    </g>
                  );
                })}
                {yearSpans.map((span) => {
                  const x = (xFor(span.start) + xFor(span.end)) / 2;
                  return <text key={span.year} x={x} y={chartBottom + 46} textAnchor="middle" fill="#86868B" fontSize="10">{span.year}년</text>;
                })}
              </svg>
            ) : (
              <div className="grid h-[304px] place-items-center rounded-[10px] border border-[#2C2C2E] text-[13px] text-[#86868B]">시점이 확정된 공급 데이터가 없습니다.</div>
            )}
          </div>
          {unknownRows.length ? (
            <button
              type="button"
              disabled={typeof detailCountForPeriod === 'function' && detailCountForPeriod('미정', seriesType) <= 0}
              data-supply-chart-unknown="true"
              data-supply-chart-clickable={typeof detailCountForPeriod !== 'function' || detailCountForPeriod('미정', seriesType) > 0 ? 'true' : 'false'}
              onClick={() => onPeriodClick?.('미정', seriesType)}
              className="group flex h-full min-h-[304px] flex-col rounded-[12px] border border-[#333333] bg-[#151515] p-4 text-left hover:border-[#5A5A5D]"
            >
              <div className="flex items-baseline justify-between gap-3">
                <div className="text-[14px] font-semibold text-white">공급 시점 미정</div>
                <div className="text-[14px] font-semibold text-white">{formatter(unknownTotal)}</div>
              </div>
              <div className="mt-4 flex flex-1 flex-col justify-center gap-2">
                {unknownSeries.map((item, index) => {
                  const value = unknownValueFor(item);
                  const widthPct = unknownTotal ? (value / unknownTotal) * 100 : 0;
                  return (
                    <div key={item} className="grid grid-cols-[150px_minmax(0,1fr)_82px] items-center gap-2 text-[11px]">
                      <div className="truncate text-[#C7C7CC]" title={item}>{item}</div>
                      <div className="h-3 rounded-full bg-[#242426]">
                        <div
                          className="h-3 rounded-full"
                          style={{ width: `${Math.max(3, widthPct)}%`, backgroundColor: displayColorFor(item, index), opacity: displayOpacityFor(item) }}
                          onMouseMove={(event) => setHover({ x: event.clientX, y: event.clientY, title: `미정 · ${item}`, value: formatter(value) })}
                          onMouseLeave={() => setHover(null)}
                        />
                      </div>
                      <div className="text-right tabular-nums text-[#A1A1AA]">{formatter(value)}</div>
                    </div>
                  );
                })}
              </div>
            </button>
          ) : null}
          <div className="xl:col-span-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 pt-0 text-[11px] text-[#A1A1AA]">
            {series.map((item, index) => (
              <button
                key={item}
                type="button"
                className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 transition ${focusedSeries === item ? 'border-[#E5E7EB] text-white' : 'border-transparent hover:border-[#3A3A3C] hover:text-white'}`}
                aria-pressed={focusedSeries === item}
                data-supply-chart-legend="true"
                data-supply-chart-legend-active={focusedSeries === item ? 'true' : 'false'}
                data-supply-chart-legend-muted={focusedSeries && focusedSeries !== item ? 'true' : 'false'}
                onClick={() => setFocusedSeries((current) => current === item ? '' : item)}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: displayColorFor(item, index), opacity: displayOpacityFor(item) }} />
                {item}
              </button>
            ))}
          </div>
        </div>
      ) : <div className="grid h-[304px] place-items-center text-[13px] text-[#86868B]">표시할 차트 데이터가 없습니다.</div>}
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
      <div className="custom-scrollbar flex max-w-full gap-1 overflow-x-auto pb-1">
        {rows.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`h-7 shrink-0 rounded-full border px-2.5 text-[11px] font-semibold ${value === option.value ? 'border-white bg-white text-[#1F1F1E]' : 'border-[#3A3A3C] text-[#A1A1AA] hover:text-white'}`}
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
          className={`h-7 rounded-full border px-2.5 text-[11px] font-semibold ${value === '전체' ? 'border-white bg-white text-[#1F1F1E]' : 'border-[#3A3A3C] text-[#A1A1AA] hover:text-white'}`}
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
  const assetLabel = text(firstText(row.asset_name, row.asset_display_name, assetLabelForFundId(row.fund_id, funds)));
  const assetKey = text(firstText(row.asset_id, row.asset_code, assetLabel), '');
  return {
    ...row,
    asset_display_label: assetLabel,
    asset_match_key: assetKey,
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

function formatLoanMaturityMonthLabel(value) {
  const source = text(value, '');
  const match = source.match(/^(20\d{2})-(\d{2})$/u);
  return match ? `${Number(match[2])}월` : source || '-';
}

function yearFromMonthKey(value) {
  const match = text(value, '').match(/^(20\d{2})-(\d{2})$/u);
  return match ? match[1] : '';
}

function loanMaturityYearBands(rows) {
  return safeArray(rows).reduce((bands, row, index) => {
    const year = yearFromMonthKey(row.month_key);
    const last = bands[bands.length - 1];
    if (last && last.year === year) {
      last.count += 1;
      return bands;
    }
    bands.push({ year, start: index, count: 1 });
    return bands;
  }, []);
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
  const maxValue = Math.max(...visibleRows.map((row) => number(row.value)), 0);
  const { maxTick, ticks } = loanMaturityAxis(maxValue);
  const axisWidth = 76;
  const plotRightPadding = 8;
  const plotHeight = Math.max(240, (ticks.length - 1) * 32);
  const yearBands = loanMaturityYearBands(visibleRows);
  return (
    <div className="relative rounded-[12px] border border-[#333333] bg-[#171717] p-4" data-chart-role="loan-maturity-timeline" data-chart-empty={visibleRows.length ? 'false' : 'true'}>
      {visibleRows.length ? (
        <div className="overflow-hidden pb-1">
          <div className="relative w-full" style={{ height: `${plotHeight + 78}px` }}>
            <div className="absolute inset-x-0 top-2" style={{ height: plotHeight }}>
              <span className="absolute top-0 bottom-0 w-px bg-[#5A5A5F]" style={{ left: axisWidth }} aria-hidden="true" />
              {ticks.map((tickValue) => (
                <div key={tickValue} className="absolute left-0 right-0" style={{ bottom: `${(tickValue / maxTick) * plotHeight}px` }}>
                  <span
                    className="absolute left-0 -translate-y-1/2 whitespace-nowrap pr-3 text-right text-[11px] leading-none text-[#A1A1AA]"
                    style={{ width: axisWidth }}
                    data-y-axis-label="loan-maturity"
                  >
                    {formatKrwAxis(tickValue)}
                  </span>
                  <span className="absolute h-px bg-[#3A3A3C]/70" style={{ left: axisWidth, right: plotRightPadding }} />
                </div>
              ))}
            </div>
            <div className="absolute flex items-end gap-1" style={{ left: axisWidth, right: plotRightPadding, top: 8, height: plotHeight }}>
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
                    className="group flex min-w-0 flex-1 items-end justify-center"
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
                      className="block w-full max-w-[28px] rounded-t-[4px] transition-opacity group-hover:opacity-80"
                      style={{ height: `${value ? Math.max(10, Math.min(plotHeight, (value / maxTick) * plotHeight)) : 2}px`, backgroundColor: value ? CHART_COLORS.primary : '#4A4A4F' }}
                    />
                  </button>
                );
              })}
            </div>
            <div
              className="absolute grid gap-1 border-t border-[#3A3A3C] pt-2 text-center text-[11px] leading-none text-[#C7C7CC]"
              style={{ left: axisWidth, right: plotRightPadding, top: plotHeight + 18, gridTemplateColumns: `repeat(${visibleRows.length}, minmax(0, 1fr))` }}
            >
              {visibleRows.map((row) => (
                <div key={`${row.month_key}-month`} className="truncate" title={formatLoanMaturityMonthLabel(row.month_key)}>{formatLoanMaturityMonthLabel(row.month_key)}</div>
              ))}
            </div>
            <div
              className="absolute grid gap-1 text-center text-[11px] font-semibold leading-none text-[#86868B]"
              style={{ left: axisWidth, right: plotRightPadding, top: plotHeight + 44, gridTemplateColumns: `repeat(${visibleRows.length}, minmax(0, 1fr))` }}
            >
              {yearBands.map((band) => (
                <div key={`${band.year}-${band.start}`} className="truncate border-t border-[#2D2D30] pt-2" style={{ gridColumn: `${band.start + 1} / span ${band.count}` }}>
                  {band.year ? `${band.year}년` : '-'}
                </div>
              ))}
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
    const assetKey = text(row.asset_match_key, label);
    const current = grouped.get(assetKey) || {
      row_key: `loan-rate-${assetKey}-${trancheFilter}`,
      asset_match_key: assetKey,
      asset_display_label: label,
      tranche_label: trancheFilter,
      tranche_filter: trancheFilter,
      weighted_amount_krw: 0,
      details: [],
    };
    current.weighted_amount_krw += number(row.amount_krw);
    current.details.push(row);
    grouped.set(assetKey, current);
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

const ASSET_SPEC_DEFAULT_ROWS = [
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
].map(([row_number, label]) => ({ row_number, label, value: '' }));

function assetSpecRowsFor(row) {
  const payloadRows = safeArray(row?.spec?.payload?.spec_rows);
  const byNumber = new Map(payloadRows.map((item) => [number(item.row_number), item]));
  return ASSET_SPEC_DEFAULT_ROWS.map((def) => {
    const stored = byNumber.get(def.row_number) || {};
    return {
      ...def,
      ...stored,
      label: text(stored.label, def.label),
      value: text(stored.value, ''),
    };
  });
}

function assetSpecValue(row, rowNumber, fallback = '') {
  const specRow = assetSpecRowsFor(row).find((item) => number(item.row_number) === rowNumber);
  return text(specRow?.value, fallback);
}

const ASSET_SPEC_COMPARE_SLOT_COUNT = 4;

function assetSpecComparisonRows(targets, maybeRight) {
  const comparisonTargets = Array.isArray(targets)
    ? targets.slice(0, ASSET_SPEC_COMPARE_SLOT_COUNT)
    : [targets, maybeRight].slice(0, ASSET_SPEC_COMPARE_SLOT_COUNT);
  return ASSET_SPEC_DEFAULT_ROWS.map((def) => {
    const values = comparisonTargets.map((target) => assetSpecValue(target, def.row_number));
    return values.reduce((row, value, index) => ({
      ...row,
      [`value_${index}`]: value,
    }), {
      row_number: def.row_number,
      label: def.label,
      values,
    });
  });
}

function formatSpecComparisonValue(value) {
  const source = text(value, '');
  if (!source) return '-';
  const formatFragment = (fragment) => {
    const parsed = Number(String(fragment).replace(/,/gu, ''));
    if (!Number.isFinite(parsed)) return fragment;
    const rounded = Math.round(parsed * 10) / 10;
    return new Intl.NumberFormat('ko-KR', {
      minimumFractionDigits: Number.isInteger(rounded) ? 0 : 1,
      maximumFractionDigits: 1,
    }).format(rounded);
  };
  if (/^-?\d[\d,]*(?:\.\d+)?$/u.test(source.trim())) return formatFragment(source.trim());
  return source.replace(/-?\d[\d,]*\.\d+/gu, (match) => formatFragment(match));
}

function SpecComparisonPanel({ rows, labels = [], empty = '비교 데이터가 없습니다.' }) {
  const visibleRows = safeArray(rows);
  const compareLabels = safeArray(labels).slice(0, ASSET_SPEC_COMPARE_SLOT_COUNT);
  const columnCount = Math.max(1, Math.min(ASSET_SPEC_COMPARE_SLOT_COUNT, compareLabels.length || visibleRows[0]?.values?.length || 1));
  const minWidth = 68 + 230 + (columnCount * 230);
  const gridTemplateColumns = `68px 230px repeat(${columnCount}, minmax(220px, 1fr))`;
  if (!visibleRows.length) {
    return <div className="grid h-[180px] place-items-center rounded-[12px] border border-[#333333] bg-[#171717] text-[13px] text-[#86868B]">{empty}</div>;
  }
  return (
    <div className="overflow-hidden rounded-[12px] border border-[#333333] bg-[#171717]" data-asset-spec-compare-panel="true">
      <div className="grid border-b border-[#333333] bg-[#202020] text-[12px] font-semibold uppercase text-[#A1A1AA]" style={{ gridTemplateColumns, minWidth }}>
        <div className="px-3 py-3 text-right">행</div>
        <div className="px-3 py-3">항목</div>
        {Array.from({ length: columnCount }).map((_, index) => (
          <div key={`header-${index}`} className="min-w-0 border-l border-[#2D2D30] px-3 py-3 text-[#E5E5E5]">
            <span className="block truncate" title={compareLabels[index] || `비교 ${index + 1}`}>{compareLabels[index] || `비교 ${index + 1}`}</span>
          </div>
        ))}
      </div>
      <div className="custom-scrollbar max-h-[560px] overflow-auto">
        <div className="divide-y divide-[#2D2D30]" style={{ minWidth }}>
          {visibleRows.map((row) => (
            <div key={row.row_number} className="grid bg-[#171717] text-[12px] text-[#E5E5E5] hover:bg-white/[0.025]" style={{ gridTemplateColumns }}>
              <div className="px-3 py-3 text-right text-[#86868B]">{row.row_number}</div>
              <div className="min-w-0 border-l border-[#2D2D30] px-3 py-3 font-semibold leading-5 text-white"><span className="block truncate" title={row.label}>{row.label}</span></div>
              {Array.from({ length: columnCount }).map((_, index) => (
                <div key={`${row.row_number}-${index}`} className="min-w-0 border-l border-[#2D2D30] px-3 py-3 leading-5 text-[#D6D6D6]">
                  <span className="block truncate" title={formatSpecComparisonValue(row.values?.[index] ?? row[`value_${index}`])}>{formatSpecComparisonValue(row.values?.[index] ?? row[`value_${index}`])}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function normalizeAssetSpecEditorRows(rows) {
  const incoming = safeArray(rows);
  const byNumber = new Map(incoming.map((item) => [number(item.row_number), item]));
  return ASSET_SPEC_DEFAULT_ROWS.map((def) => {
    const row = byNumber.get(def.row_number) || {};
    return {
      row_number: def.row_number,
      label: text(row.label, def.label),
      value: text(row.value, ''),
    };
  });
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
    <div
      className="w-full max-w-[1480px] mx-auto px-8 pt-8 pb-14"
      data-testid="market-data-dashboard"
      data-market-tab={currentTab}
    >
      <ModuleHeader
        eyebrow="MARKET DATA"
        title="시장 데이터 개요"
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
            <MetricCard label="최신 기준" value={text(summary.latest_lease_period, '-')} detail="Excel 원천 기준 시점" />
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

export function MarketDataDashboard({ activeTab = 'overview' }) {
  const currentTab = MARKET_TABS.find((tab) => tab.id === activeTab || tab.route === activeTab)?.id || 'overview';
  const marketReadPayload = useMemo(() => marketReadPayloadFor(currentTab), [currentTab]);
  const { loading, error, data } = useEdgeData('sector-market/read', marketReadPayload, [currentTab]);
  const [modal, setModal] = useState(null);
  const [txnWindow, setTxnWindow] = useState('3y');
  const [txnRegion, setTxnRegion] = useState('전체');
  const [txnTemp, setTxnTemp] = useState('전체');
  const [txnType, setTxnType] = useState('전체');
  const [txnSizeRegion, setTxnSizeRegion] = useState('전체');
  const [txnSizePeriod, setTxnSizePeriod] = useState('2026');
  const [txnSizeBucket, setTxnSizeBucket] = useState('전체');
  const [txnSizeTemp, setTxnSizeTemp] = useState('전체');
  const [leaseSegment, setLeaseSegment] = useState('복합 전체');
  const [leaseMeasure, setLeaseMeasure] = useState('rent_manwon_per_py');
  const [leaseRegion, setLeaseRegion] = useState('전체');
  const [leaseSearch, setLeaseSearch] = useState('');
  const [leaseCenterTemp, setLeaseCenterTemp] = useState('전체');
  const [leaseStatisticPeriod, setLeaseStatisticPeriod] = useState('');
  const [overviewLeaseTemp, setOverviewLeaseTemp] = useState('전체');
  const [overviewTxnTemp, setOverviewTxnTemp] = useState('전체');
  const [leaseHistoryPeriod, setLeaseHistoryPeriod] = useState('전체');
  const [leaseHistoryRegion, setLeaseHistoryRegion] = useState('전체');
  const [leaseHistorySearch, setLeaseHistorySearch] = useState('');
  const [supplyStart, setSupplyStart] = useState(SUPPLY_PERIOD_DEFAULT_START);
  const [supplyEnd, setSupplyEnd] = useState(SUPPLY_PERIOD_DEFAULT_END);
  const [supplyPeriodTouched, setSupplyPeriodTouched] = useState(false);
  const [supplyKind, setSupplyKind] = useState('전체');
  const summary = data?.summary || {};
  const marketViews = data?.views || {};
  const overviewView = marketViews.overview || {};
  const leaseView = marketViews.lease || {};
  const supplyView = marketViews.supply || {};
  const transactionView = marketViews.transactions || {};
  const sourceView = marketViews.source || {};
  const leases = safeArray(data?.leases).length
    ? safeArray(data?.leases)
    : (safeArray(leaseView.history_rows).length
      ? safeArray(leaseView.history_rows)
      : safeArray(leaseView.all_rows || leaseView.latest_rows));
  const supply = safeArray(data?.supply).length
    ? safeArray(data?.supply)
    : (safeArray(supplyView.rows).length ? safeArray(supplyView.rows) : safeArray(overviewView.supply_rows));
  const transactions = safeArray(data?.transactions).length
    ? safeArray(data?.transactions)
    : (safeArray(transactionView.rows).length ? safeArray(transactionView.rows) : safeArray(overviewView.transaction_rows));
  const capRates = safeArray(data?.cap_rates).length ? safeArray(data?.cap_rates) : safeArray(transactionView.charts?.cap_rate_series || marketViews.overview?.charts?.cap_rate_series);
  const sources = safeArray(data?.sources).length ? safeArray(data?.sources) : safeArray(sourceView.sources);
  const charts = firstNonEmptyObject(data?.charts, marketViews[currentTab]?.charts, marketViews.overview?.charts);
  const overviewChartSource = firstNonEmptyObject(marketViews.overview?.charts, charts);
  const transactionRegionChartRows = safeArray(
    overviewChartSource.transactions_by_region
    || overviewChartSource.transaction_amount_by_region
    || charts.transactions_by_region
    || charts.transaction_amount_by_region
  );
  const overviewLeaseStatisticFallbackRows = safeArray(overviewChartSource.lease_rent_by_region || charts.lease_rent_by_region).map((row) => ({
    ...row,
    period_label: summary.latest_lease_period || 'latest',
    metric_key: 'rent_manwon_per_py',
    dimension_type: 'region',
    segment_label: '복합 상온',
    is_average: false,
    region: row.region || row.label,
    value: row.value,
  }));
  const overviewSupplyStatisticFallbackRows = safeArray(overviewChartSource.supply_by_period || charts.supply_by_period).map((row) => ({
    ...row,
    series_type: 'new_supply',
    period_label: row.period_label || row.label,
    label: row.label || '합계',
    value: row.value,
  }));
  const normalizeSupplyStatisticRowsForChart = (rows) => safeArray(rows).flatMap((row) => {
    if (text(row.series_type, '')) return [row];
    const periodLabel = text(row.period_label || row.completion_period || row.label, '');
    if (!periodLabel) return [];
    const label = text(row.label, '합계');
    const out = [];
    const newSupplyValue = firstText(row.new_supply, row.new_supply_area_py, row.value);
    if (newSupplyValue !== undefined && newSupplyValue !== null) {
      out.push({ ...row, series_type: 'new_supply', period_label: periodLabel, label, value: number(newSupplyValue) });
    }
    const cumulativeValue = firstText(row.cumulative_supply, row.cumulative_supply_area_py);
    if (cumulativeValue !== undefined && cumulativeValue !== null) {
      out.push({ ...row, series_type: 'cumulative_supply', period_label: periodLabel, label, value: number(cumulativeValue) });
    }
    return out;
  });
  const overviewLeaseStatisticRows = safeArray(overviewView.lease_statistics_rows);
  const leaseStatisticRows = safeArray(leaseView.statistics_rows).length
    ? safeArray(leaseView.statistics_rows)
    : (overviewLeaseStatisticRows.length ? overviewLeaseStatisticRows : overviewLeaseStatisticFallbackRows);
  const normalizedSupplyStatisticRows = normalizeSupplyStatisticRowsForChart(
    safeArray(supplyView.statistics_rows).length ? supplyView.statistics_rows : overviewView.supply_statistics_rows,
  );
  const supplyStatisticRows = normalizedSupplyStatisticRows.length ? normalizedSupplyStatisticRows : overviewSupplyStatisticFallbackRows;
  const sourceAudit = summary.source_audit || {};
  const expectedCounts = summary.expected_counts || {};
  const readback = summary.readback || {};
  useEffect(() => {
    if (!data || loading) return undefined;
    let cancelled = false;
    const queue = MARKET_TABS
      .map((tab) => tab.id)
      .filter((tabId) => tabId !== currentTab);
    const run = async () => {
      for (const tabId of queue) {
        if (cancelled || document.visibilityState === 'hidden') break;
        await new Promise((resolve) => window.setTimeout(resolve, 160));
        if (cancelled || document.visibilityState === 'hidden') break;
        try {
          await primeEdgeData('sector-market/read', marketReadPayloadFor(tabId));
        } catch {
          // Background warming should never replace visible data with an error.
        }
      }
    };
    const idleId = typeof window.requestIdleCallback === 'function'
      ? window.requestIdleCallback(run, { timeout: 1800 })
      : window.setTimeout(run, 450);
    return () => {
      cancelled = true;
      if (typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(idleId);
      else window.clearTimeout(idleId);
    };
  }, [currentTab, data, loading]);
  const supplyKindOptions = [
    { value: '전체', label: '전체' },
    { value: 'new_supply', label: '신규공급' },
    { value: 'pipeline', label: '공급예정' },
  ];
  const leaseStatisticPeriods = safeArray(leaseView.statistics_periods).length
    ? safeArray(leaseView.statistics_periods)
    : (safeArray(overviewView.lease_statistics_periods).length
      ? safeArray(overviewView.lease_statistics_periods)
      : [...new Set(leaseStatisticRows.map((row) => text(row.period_label, '')).filter(Boolean))]);
  const selectedLeaseStatisticPeriod = leaseStatisticPeriod || text(leaseView.statistics_latest_period || overviewView.lease_statistics_latest_period, '') || leaseStatisticPeriods.at(-1) || '';
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
  const leaseCenterTempOptions = ['전체', '복합 전체', '복합 상온', '복합 저온', '상온', '저온', '상온(복합포함)', '저온(복합포함)'];
  const leaseTemperatureMatches = (selection, rawTemperature) => {
    const temp = text(rawTemperature);
    if (selection === '전체') return true;
    const hasComplex = /복합/iu.test(temp);
    const hasDry = /상온|dry|ambient/iu.test(temp);
    const hasCold = /저온|냉동|냉장|cold/iu.test(temp);
    if (selection === '복합 전체') return hasComplex;
    if (selection === '복합 상온') return hasComplex && hasDry;
    if (selection === '복합 저온') return hasComplex && hasCold;
    if (selection === '상온') return hasDry && !hasComplex && !hasCold;
    if (selection === '저온') return hasCold && !hasComplex && !hasDry;
    if (selection === '상온(복합포함)') return hasDry;
    if (selection === '저온(복합포함)') return hasCold;
    return true;
  };
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
  const leaseMetricFormatterFor = (metric) => (metric === 'vacancy_rate' ? formatRate : (value) => formatNumber(value, 1));
  const leaseMetricFormatter = leaseMetricFormatterFor(leaseMeasure);
  const leaseStatisticAvailableSegments = new Set(leaseStatisticRows.map((row) => text(row.segment_label, '')).filter(Boolean));
  const leaseSegmentOptions = ['복합 전체', '복합 상온', '복합 저온', '상온', '저온', '상온(복합포함)', '저온(복합포함)']
    .filter((option) => leaseStatisticAvailableSegments.size === 0 || leaseStatisticAvailableSegments.has(option));
  useEffect(() => {
    if (leaseSegmentOptions.length && !leaseSegmentOptions.includes(leaseSegment)) setLeaseSegment(leaseSegmentOptions[0]);
  }, [leaseSegment, leaseSegmentOptions.join('|')]);
  const leaseStatisticBaseRows = leaseStatisticRows.filter((row) => (
    text(row.period_label) === selectedLeaseStatisticPeriod
    && text(row.metric_key) === leaseMeasure
    && text(row.dimension_type) === 'region'
    && row.is_average !== true
  ));
  const leaseStatisticDisplayRows = leaseStatisticBaseRows.filter((row) => text(row.segment_label) === leaseSegment);
  const leaseComparisonSegmentGroups = [
    ['상온(복합포함)', '저온(복합포함)'],
    ['복합 상온', '복합 저온'],
    ['상온', '저온'],
    ['복합 전체'],
  ];
  const leaseComparisonSegments = (
    leaseComparisonSegmentGroups.find((group) => group.some((segment) => leaseStatisticAvailableSegments.has(segment))) || []
  ).filter((segment) => leaseStatisticAvailableSegments.has(segment));
  const leaseStatisticComparisonRows = leaseStatisticBaseRows
    .filter((row) => (leaseComparisonSegments.length ? leaseComparisonSegments.includes(text(row.segment_label)) : true))
    .map((row) => ({
      label: regionDisplay(row.region || row.label),
      region: row.region || row.label,
      series: text(row.segment_label),
      value: row.value,
      metric_label: row.metric_label,
    }));
  const leaseStatisticChartRows = leaseStatisticDisplayRows.map((row) => ({
    label: regionDisplay(row.region || row.label),
    region: row.region || row.label,
    series: text(row.segment_label),
    value: row.value,
    metric_label: row.metric_label,
  }));
  const leaseStatisticCapitalChartRows = leaseStatisticChartRows.filter((row) => /^\(수도권\)/u.test(row.label));
  const leaseStatisticLocalChartRows = leaseStatisticChartRows.filter((row) => /^\(지방\)/u.test(row.label));
  const leaseStatisticSummaryCards = [
    {
      label: '수도권 평균',
      rows: leaseStatisticDisplayRows.filter((row) => isCapitalRegion(row.region || row.label)),
    },
    {
      label: '지방 평균',
      rows: leaseStatisticDisplayRows.filter((row) => isLocalRegion(row.region || row.label)),
    },
    {
      label: '표시 권역',
      rows: leaseStatisticDisplayRows,
      countOnly: true,
    },
  ].map((item) => {
    if (item.countOnly) return { label: item.label, value: `${formatNumber(item.rows.length)}개`, detail: selectedLeaseStatisticPeriod || '-' };
    const values = item.rows.map((row) => number(row.value)).filter((value) => Number.isFinite(value));
    const average = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
    return {
      label: item.label,
      value: average == null ? '-' : leaseMetricFormatter(average),
      detail: `${formatNumber(values.length)}개 권역`,
    };
  });
  const openLeaseStatisticModal = (row) => {
    const seriesLabel = currentTab === 'overview' ? text(row.series || row.segment_label, '') : leaseSegment;
    const clickedRegion = regionValue(row?.region || row?.label || '');
    setModal({
      type: 'lease-statistic-explorer',
      title: '최신 임대시장 통계 상세',
      baseRows: leaseStatisticRows,
      filters: {
        period: selectedLeaseStatisticPeriod,
        metric: leaseMeasure,
        segment: seriesLabel && seriesLabel !== '전체' ? seriesLabel : leaseSegment,
        scope: '전체',
        region: clickedRegion || '전체',
      },
      columns: [
        { key: 'period_label', label: '시점', width: 120 },
        { key: 'region', label: '권역', width: 160, render: (item) => regionDisplay(item.region || item.label), sortValue: (item) => regionDisplay(item.region || item.label) },
        { key: 'segment_label', label: '상/저온 구분', width: 180 },
        { key: 'metric_label', label: '지표', width: 220 },
        { key: 'value', label: '값', align: 'right', render: (item) => leaseMetricFormatterFor(text(item.metric_key, leaseMeasure))(item.value), sortValue: (item) => number(item.value) },
      ],
      width: 'max-w-[calc(100vw-32px)]',
      minWidth: 940,
      maxHeight: 'calc(100vh - 150px)',
      fullscreen: true,
      defaultSort: [{ key: 'segment_label', direction: 'asc' }, { key: 'value', direction: 'desc' }],
    });
  };
  const leaseStatisticTableColumns = [
    { key: 'period_label', label: '시점', width: 110 },
    { key: 'region', label: '권역', width: 160, render: (item) => regionDisplay(item.region || item.label), sortValue: (item) => regionDisplay(item.region || item.label) },
    { key: 'segment_label', label: '상/저온 구분', width: 160 },
    { key: 'metric_label', label: '지표', width: 190 },
    { key: 'value', label: '값', align: 'right', render: (item) => leaseMetricFormatter(item.value), sortValue: (item) => number(item.value) },
  ];
  const overviewLeaseTempOptions = ['전체', ...leaseSegmentOptions.filter((option) => option !== '전체')];
  const overviewLeaseRentBaseRows = leaseStatisticRows
    .filter((row) => text(row.period_label) === selectedLeaseStatisticPeriod && text(row.metric_key) === 'rent_manwon_per_py' && text(row.dimension_type) === 'region' && row.is_average !== true);
  const overviewLeaseRentComparisonRows = overviewLeaseRentBaseRows
    .filter((row) => (leaseComparisonSegments.length ? leaseComparisonSegments.includes(text(row.segment_label)) : true))
    .map((row) => ({
      label: regionDisplay(row.region || row.label),
      region: row.region || row.label,
      series: text(row.segment_label),
      value: row.value,
      metric_label: row.metric_label,
    }));
  const overviewDefaultLeaseSegment = leaseComparisonSegments[0] || text(overviewLeaseRentBaseRows[0]?.segment_label, '');
  const overviewLeaseRentSelectedRows = (overviewLeaseTemp === '전체'
    ? overviewLeaseRentBaseRows.filter((row) => !overviewDefaultLeaseSegment || text(row.segment_label) === overviewDefaultLeaseSegment)
    : overviewLeaseRentBaseRows.filter((row) => text(row.segment_label) === overviewLeaseTemp)
  ).map((row) => ({
    label: regionDisplay(row.region || row.label),
    region: row.region || row.label,
    series: text(row.segment_label),
    value: row.value,
    count: 1,
  }));
  const overviewTransactionTempOptions = ['전체', ...new Set(transactions.map((row) => text(row.temperature_type, '')).filter(Boolean))].slice(0, 10);
  const overviewFilteredTransactions = transactions.filter((row) => overviewTxnTemp === '전체' || text(row.temperature_type) === overviewTxnTemp);
  const overviewTransactionRows = overviewFilteredTransactions.length
    ? aggregateBy(
      overviewFilteredTransactions,
      (row) => regionDisplay(row.region),
      (row) => row.transaction_amount_krw,
    ).map((row) => ({ ...row, region: row.label }))
    : transactionRegionChartRows.map((row) => ({
      label: regionDisplay(row.region || row.label),
      region: row.region || row.label,
      value: number(row.transaction_amount_krw ?? row.total_transaction_amount_krw ?? row.amount_krw ?? row.total_amount_krw ?? row.market_size_krw ?? row.value),
      count: number(row.count || row.transaction_count),
    })).filter((row) => text(row.label, '') && Number.isFinite(number(row.value)));
  const overviewSupplyRows = (() => {
    const grouped = new Map();
    safeArray(supply).forEach((row) => {
      const value = supplyArea(row);
      if (!Number.isFinite(Number(value)) || Number(value) <= 0) return;
      const period = supplyPeriodLabel(row) || '미정';
      const region = regionValue(row.region || row.region_group || row.market_region || row.label);
      const key = `${period}|${region}`;
      const current = grouped.get(key) || {
        series_type: 'supply_period',
        period_label: period,
        label: region,
        region,
        value: 0,
        count: 0,
      };
      current.value += Number(value);
      current.count += 1;
      grouped.set(key, current);
    });
    const rows = [...grouped.values()].sort((a, b) => (
      periodSortValue(a.period_label) - periodSortValue(b.period_label)
      || regionValue(a.region).localeCompare(regionValue(b.region), 'ko')
    ));
    if (rows.length) return rows;
    return safeArray(overviewChartSource.supply_by_period || charts.supply_by_period).map((row) => ({
      ...row,
      series_type: 'supply_period',
      period_label: row.period_label || row.label,
      label: row.region || '합계',
      region: row.region || row.label,
      value: row.value,
    }));
  })();
  const leaseSegmentedRows = latestLeases.filter((row) => leaseTemperatureMatches(leaseCenterTemp, row.temperature_type));
  const filteredLeaseRows = leaseSegmentedRows
    .filter((row) => regionMatches(leaseRegion, row.region))
    .filter((row) => !leaseSearch || `${row.center_name} ${row.legal_address}`.toLowerCase().includes(leaseSearch.toLowerCase()))
    .sort((a, b) => number(b.gross_area_py || b.leasable_area_py) - number(a.gross_area_py || a.leasable_area_py));
  const newSupplyRows = supply.filter((row) => row.supply_kind === 'new_supply');
  const pipelineRows = supply.filter((row) => row.supply_kind === 'pipeline');
  const filteredSupplyRows = supplyKind === '전체' ? [...newSupplyRows, ...pipelineRows] : supply.filter((row) => row.supply_kind === supplyKind);
  const supplyTimelinePeriods = [...new Set(filteredSupplyRows.map(supplyPeriodLabel).filter((label) => label && label !== '미정'))]
    .sort((a, b) => periodSortValue(a) - periodSortValue(b));
  const rangedPipelineRows = filteredSupplyRows.filter((row) => {
    const startDate = supplyDate(row);
    const endDate = supplyDate(row, true);
    if (!startDate) return !supplyPeriodTouched;
    return endDate >= supplyStart && startDate <= supplyEnd;
  });
  const supplyStatisticRowsInRange = supplyStatisticRows.filter((row) => {
    const period = text(row.period_label, '');
    if (!period) return false;
    if (isUnknownPeriodLabel(period)) return !supplyPeriodTouched;
    const startDate = periodDate(period);
    const endDate = periodDate(period, true);
    return Boolean(startDate && endDate && endDate >= supplyStart && startDate <= supplyEnd);
  });
  const selectedSupplyPeriods = supplyTimelinePeriods.filter((period) => {
    const startDate = periodDate(period);
    const endDate = periodDate(period, true);
    return startDate && endDate && endDate >= supplyStart && startDate <= supplyEnd;
  });
  const supplyAreaRowsFromCases = (rows, periods, seriesType, cumulative = false, includeUnknown = false) => {
    const grouped = new Map();
    periods.forEach((period) => {
      const targetSort = periodSortValue(period);
      rows.forEach((row) => {
        const rowPeriod = supplyPeriodLabel(row);
        const rowUnknown = !rowPeriod || isUnknownPeriodLabel(rowPeriod);
        if (rowUnknown) {
          if (!includeUnknown || !isUnknownPeriodLabel(period)) return;
        }
        const rowSort = periodSortValue(rowPeriod);
        const inPeriod = rowUnknown ? true : (cumulative ? rowSort <= targetSort : rowPeriod === period);
        if (!inPeriod) return;
        const region = regionValue(row.region || row.region_group || '미분류');
        const key = `${seriesType}|${period}|${region}`;
        const current = grouped.get(key) || {
          series_type: seriesType,
          period_label: period,
          label: region,
          region,
          value: 0,
          count: 0,
        };
        current.value += supplyArea(row);
        current.count += 1;
        grouped.set(key, current);
      });
    });
    return [...grouped.values()].filter((row) => row.value > 0);
  };
  const selectedSupplyPeriodsWithUnknown = !supplyPeriodTouched && rangedPipelineRows.some((row) => isUnknownPeriodLabel(supplyPeriodLabel(row)))
    ? [...selectedSupplyPeriods, '미정']
    : selectedSupplyPeriods;
  const fallbackPipelineSupplyChartRows = supplyAreaRowsFromCases(rangedPipelineRows, selectedSupplyPeriodsWithUnknown, 'pipeline_supply', false, true);
  const fallbackNewSupplyChartRows = supplyAreaRowsFromCases(rangedPipelineRows, selectedSupplyPeriods, 'new_supply', false);
  const fallbackCumulativeSupplyChartRows = supplyAreaRowsFromCases(filteredSupplyRows, selectedSupplyPeriods, 'cumulative_supply', true);
  const supplyChartRowsInRange = [
    ...supplyStatisticRowsInRange,
    ...fallbackPipelineSupplyChartRows,
    ...(supplyStatisticRowsInRange.some((row) => row.series_type === 'new_supply') ? [] : fallbackNewSupplyChartRows),
    ...(supplyStatisticRowsInRange.some((row) => row.series_type === 'cumulative_supply') ? [] : fallbackCumulativeSupplyChartRows),
  ];
  const datedCumulativeNewRows = newSupplyRows.filter((row) => number(row.expected_year || row.completion_year) >= 2024);
  const cumulativeNewRows = datedCumulativeNewRows.length ? datedCumulativeNewRows : newSupplyRows;
  function aggregateBy(rows, keyFn, valueFn, weightFn = null) {
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
  }
  const supplyPeriodRows = aggregateBy(filteredSupplyRows, supplyPeriodLabel, supplyArea).sort((a, b) => String(a.label).localeCompare(String(b.label), 'ko'));
  const transactionMetricCards = [
    { label: '거래면적', value: filteredTransactions.reduce((sum, row) => sum + number(row.area_py), 0), formatter: (value) => `${formatNumber(value, 1)}평`, detail: '필터 적용 합계' },
    { label: '거래건수', value: filteredTransactions.length, formatter: (value) => `${formatNumber(value)}건`, detail: '중복 제거 거래 사례' },
    { label: '평당 거래가격', value: aggregateBy(filteredTransactions, () => 'weighted', (row) => row.unit_price_krw_per_py, (row) => row.area_py)[0]?.value || 0, formatter: formatKrw, detail: '연면적 가중평균' },
    { label: '총거래가격', value: filteredTransactions.reduce((sum, row) => sum + number(row.transaction_amount_krw), 0), formatter: formatKrw, detail: '필터 적용 합계' },
  ];
  const transactionPeriodOptions = [...new Set(transactions
    .map((row) => yearFrom(row))
    .filter((year) => year >= 2010)
    .sort((a, b) => a - b)
    .map(String))];
  if (!transactionPeriodOptions.includes('2026')) transactionPeriodOptions.push('2026');
  transactionPeriodOptions.sort((a, b) => Number(a) - Number(b));
  const transactionSizeOptions = ['전체', ...TRANSACTION_SIZE_BUCKET_VALUES];
  const transactionSizeTempOptions = TRANSACTION_TEMPERATURE_OPTIONS;
  const sizeBucketNote = (
    <ul className="list-disc space-y-1 pl-4">
      {TRANSACTION_SIZE_BUCKET_RULES.map((rule) => (
        <li key={rule.value}>{rule.value}: {rule.description}</li>
      ))}
    </ul>
  );
  const sizeFilteredTransactions = transactions
    .filter((row) => regionMatches(txnSizeRegion, row.region))
    .filter((row) => String(yearFrom(row)) === txnSizePeriod)
    .filter((row) => txnSizeBucket === '전체' || transactionSizeBucketFor(row) === txnSizeBucket)
    .filter((row) => txnSizeTemp === '전체' || transactionTemperatureFor(row) === txnSizeTemp);
  const transactionTrendRows = transactions.filter((row) => {
    const year = yearFrom(row);
    const regionOk = regionMatches(txnRegion, row.region);
    const tempOk = txnTemp === '전체' || text(row.temperature_type) === txnTemp;
    const typeText = text(row.transaction_type || row.deal_type, '');
    const typeOk = txnType === '전체' || typeText === txnType;
    return year >= 2020 && regionOk && tempOk && typeOk;
  });
  const transactionMarketGroups = new Map();
  transactionTrendRows
    .filter((row) => yearFrom(row))
    .forEach((row) => {
      const series = regionDisplay(row.region);
      const key = `${yearFrom(row)}|${series}`;
      const current = transactionMarketGroups.get(key) || { label: String(yearFrom(row)), series, value: 0, area: 0, count: 0, regions: new Map() };
      current.value += number(row.transaction_amount_krw);
      current.area += number(row.area_py);
      current.count += 1;
      const regionLabel = regionDisplay(row.region);
      current.regions.set(regionLabel, (current.regions.get(regionLabel) || 0) + number(row.transaction_amount_krw));
      transactionMarketGroups.set(key, current);
    });
  const transactionMarketChartRows = [...transactionMarketGroups.values()]
    .map((row) => {
      const topRegion = [...row.regions.entries()].sort((a, b) => b[1] - a[1])[0];
      return {
        ...row,
        metric_label: `${formatNumber(row.count)}건 · ${formatNumber(row.area, 1)}평${topRegion ? ` · 최대 ${topRegion[0]} ${formatKrw(topRegion[1])}` : ''}`,
      };
    })
    .sort((a, b) => Number(a.label) - Number(b.label) || a.series.localeCompare(b.series, 'ko'));
  const transactionMarketDetailRows = aggregateBy(
    transactionTrendRows,
    (row) => `${yearFrom(row)}|${regionDisplay(row.region)}`,
    (row) => row.transaction_amount_krw,
  )
    .map((row) => {
      const [year, region] = text(row.label).split('|');
      const source = transactionTrendRows.filter((item) => String(yearFrom(item)) === year && regionDisplay(item.region) === region);
      const area = source.reduce((sum, item) => sum + number(item.area_py), 0);
      return { year, region, count: row.count, area, amount: row.value };
    })
    .sort((a, b) => Number(a.year) - Number(b.year) || regionValue(a.region).localeCompare(regionValue(b.region), 'ko'));
  const transactionMarketAssetRows = transactionTrendRows
    .map((row) => ({
      ...row,
      year: String(yearFrom(row)),
      region_display: regionDisplay(row.region),
      size_bucket_label: transactionSizeBucketFor(row),
      temperature_label: transactionTemperatureFor(row),
    }))
    .filter((row) => Number(row.year) >= 2020)
    .sort((a, b) => Number(a.year) - Number(b.year) || number(b.transaction_amount_krw) - number(a.transaction_amount_krw));
  const sizeUnitPriceRows = aggregateBy(
    sizeFilteredTransactions,
    (row) => (txnSizeBucket === '전체' ? transactionSizeBucketFor(row) : regionDisplay(row.region)),
    (row) => row.unit_price_krw_per_py,
    (row) => row.area_py,
  );
  const sizeMarketRows = aggregateBy(
    sizeFilteredTransactions,
    (row) => (txnSizeBucket === '전체' ? transactionSizeBucketFor(row) : regionDisplay(row.region)),
    (row) => row.transaction_amount_krw,
  );
  const sizeUnitPriceChartRows = sizeUnitPriceRows.map((row) => ({
    ...row,
    raw_label: row.label,
    label: txnSizeBucket === '전체' ? stripLeadingNumberLabel(row.label) : row.label,
  }));
  const sizeMarketChartRows = sizeMarketRows.map((row) => ({
    ...row,
    raw_label: row.label,
    label: txnSizeBucket === '전체' ? stripLeadingNumberLabel(row.label) : row.label,
  }));
  const openTransactionSizeModal = (row, metricTitle) => {
    const rawLabel = text(row.raw_label || row.label, '');
    const clickedBucket = TRANSACTION_SIZE_BUCKET_VALUES.includes(rawLabel) ? rawLabel : '';
    const clickedRegion = clickedBucket ? txnSizeRegion : rawLabel;
    setModal({
      type: 'transaction-size-explorer',
      title: `${metricTitle} 상세`,
      baseRows: transactions,
      filters: {
        year: txnSizePeriod || '2026',
        region: clickedRegion || txnSizeRegion || '전체',
        bucket: clickedBucket || txnSizeBucket || '전체',
        temp: txnSizeTemp || '전체',
        dealType: txnType || '전체',
      },
      columns: transactionColumns,
      width: 'max-w-[calc(100vw-32px)]',
      minWidth: 1180,
      maxHeight: 'calc(100vh - 150px)',
      fullscreen: true,
      defaultSort: { key: 'transaction_amount_krw', direction: 'desc' },
    });
  };
  const capRateMethodLabel = (row) => {
    const source = text(row.cap_rate_method || row.source_section || row.metric_label || row.source_label, '');
    if (/베이지안|bayes/iu.test(source)) return '베이지안';
    if (/가중|weighted/iu.test(source)) return '가중평균';
    if (/일반|general|ordinary/iu.test(source)) return '일반';
    return '베이지안';
  };
  const capRateDetailMap = new Map();
  capRates.forEach((row) => {
    const label = text(row.period_label || row.report_period || [row.report_year, row.report_quarter].filter(Boolean).join(' '), '미정');
    const series = text(row.region || row.scope || row.region_group || '전국');
    const method = capRateMethodLabel(row);
    const value = normalizeRateRatio(firstText(row.cap_rate, row.value, row.capital_area_cap_rate, row.national_cap_rate));
    if (label === '미정' || !Number.isFinite(Number(value)) || Number(value) === 0) return;
    const key = `${label}|${series}`;
    const current = capRateDetailMap.get(key) || { label, series, bayesian: null, general: null, weighted: null };
    if (method === '일반') current.general = value;
    else if (method === '가중평균') current.weighted = value;
    else current.bayesian = value;
    capRateDetailMap.set(key, current);
  });
  const capRateTableRows = [...capRateDetailMap.values()]
    .sort((a, b) => periodSortValue(a.label) - periodSortValue(b.label) || a.series.localeCompare(b.series, 'ko'));
  const capRateChartRows = capRateTableRows
    .map((row) => ({
      ...row,
      value: firstText(row.bayesian, row.general, row.weighted),
      metric_label: '베이지안 기준, 팝업에서 일반/가중평균 함께 확인',
    }))
    .filter((row) => Number.isFinite(Number(row.value)));
  const supplyRowsForPeriod = (periodLabel, seriesType) => {
    const targetSort = periodSortValue(periodLabel);
    const baseRows = seriesType === 'cumulative_supply'
      ? cumulativeNewRows
      : (seriesType === 'supply_period' ? supply : (seriesType === 'pipeline_supply' ? pipelineRows : newSupplyRows));
    const targetUnknown = isUnknownPeriodLabel(periodLabel);
    return baseRows
      .filter((row) => {
        const current = supplyPeriodLabel(row);
        const currentUnknown = isUnknownPeriodLabel(current);
        if (targetUnknown) return currentUnknown;
        if (!current || currentUnknown) return false;
        if (seriesType === 'cumulative_supply') return periodSortValue(current) <= targetSort;
        return current === periodLabel;
      })
      .sort((a, b) => periodSortValue(supplyPeriodLabel(a)) - periodSortValue(supplyPeriodLabel(b)) || number(b.gross_area_py) - number(a.gross_area_py));
  };
  const supplyAreaValueRowsForPeriod = (periodLabel, seriesType) => safeArray(supplyChartRowsInRange)
    .filter((row) => text(row.series_type) === seriesType)
    .filter((row) => text(row.period_label) === periodLabel)
    .filter((row) => !['합계', '전체'].includes(text(row.label || row.region)) && row.is_subtotal !== true)
    .map((row) => {
      const region = regionValue(row.region || row.label || '미분류');
      return {
        ...row,
        scope_label: regionScopeOf(region) || text(row.region_group || row.scope, '-'),
        region_label: regionDisplay(region),
        value_py: number(row.value),
        source_count: number(row.count || row.item_count || row.case_count),
      };
    })
    .sort((a, b) => regionOrderIndex(a.region_label) - regionOrderIndex(b.region_label) || number(b.value_py) - number(a.value_py));
  const supplyAreaValueColumns = [
    { key: 'period_label', label: '시점', width: 120, sortValue: (row) => periodSortValue(row.period_label) },
    { key: 'scope_label', label: '수도권/지방', width: 130, render: (row) => text(row.scope_label), sortValue: (row) => text(row.scope_label) },
    { key: 'region_label', label: '권역', width: 190, render: (row) => text(row.region_label), sortValue: (row) => regionOrderIndex(row.region_label) },
    { key: 'value_py', label: '누적 공급 면적(평)', align: 'right', render: (row) => formatNumber(row.value_py, 1), sortValue: (row) => number(row.value_py) },
    { key: 'source_count', label: '자료 수', align: 'right', render: (row) => row.source_count ? `${formatNumber(row.source_count)}건` : '-', sortValue: (row) => number(row.source_count) },
  ];
  const supplyDetailCountForPeriod = (periodLabel, seriesType) => (
    seriesType === 'cumulative_supply'
      ? supplyAreaValueRowsForPeriod(periodLabel, seriesType).length
      : supplyRowsForPeriod(periodLabel, seriesType).length
  );
  const openSupplyPeriodModal = (periodLabel, seriesType) => {
    if (seriesType === 'cumulative_supply') {
      const rows = supplyAreaValueRowsForPeriod(periodLabel, seriesType);
      setModal({
        type: 'supply-area-value-explorer',
        title: `${periodLabel} 누적 공급 면적 전체 값`,
        rows,
        columns: supplyAreaValueColumns,
        width: 'max-w-[calc(100vw-32px)]',
        minWidth: 940,
        maxHeight: 'calc(100vh - 150px)',
        fullscreen: true,
        defaultSort: [{ key: 'scope_label', direction: 'asc' }, { key: 'value_py', direction: 'desc' }],
      });
      return;
    }
    const rows = supplyRowsForPeriod(periodLabel, seriesType);
    const modalSuffix = seriesType === 'cumulative_supply'
      ? '누적 공급 자산'
      : (seriesType === 'supply_period' || seriesType === 'pipeline_supply' ? '공급 예정 자산' : '신규 공급 자산');
    setModal({
      title: `${periodLabel} ${modalSuffix}`,
      rows,
      columns: supplyColumns,
      width: 'max-w-[calc(100vw-32px)]',
      minWidth: 1180,
      maxHeight: 'calc(100vh - 150px)',
      fullscreen: true,
      defaultSort: [{ key: 'completion_period', direction: 'asc' }, { key: 'gross_area_py', direction: 'desc' }],
    });
  };
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
    { key: 'temperature_type', label: '상/저온', width: 110, render: (row) => transactionTemperatureFor(row), sortValue: (row) => transactionTemperatureFor(row) },
    { key: 'size_bucket_label', label: '규모', width: 110, render: (row) => transactionSizeBucketFor(row), sortValue: (row) => TRANSACTION_SIZE_BUCKET_VALUES.indexOf(transactionSizeBucketFor(row)) },
    { key: 'area_py', label: '면적(평)', align: 'right', render: (row) => formatNumber(row.area_py, 1), sortValue: (row) => number(row.area_py) },
    { key: 'transaction_amount_krw', label: '거래금액', align: 'right', render: (row) => formatKrw(row.transaction_amount_krw), sortValue: (row) => number(row.transaction_amount_krw) },
    { key: 'unit_price_krw_per_py', label: '평당가', align: 'right', render: (row) => formatKrw(row.unit_price_krw_per_py), sortValue: (row) => number(row.unit_price_krw_per_py) },
    { key: 'buyer_name', label: '매수인', render: (row) => text(row.buyer_name) },
    { key: 'seller_name', label: '매도인', render: (row) => text(row.seller_name) },
  ];
  const transactionMarketAssetColumns = [
    { key: 'year', label: '연도', width: 90, render: (row) => text(row.year || yearFrom(row)), sortValue: (row) => number(row.year || yearFrom(row)) },
    ...transactionColumns,
  ];
  const leaseColumns = [
    { key: 'center_name', label: '센터명', width: 190, render: (row) => text(row.center_name) },
    { key: 'region', label: '권역', width: 150, render: (row) => regionDisplay(row.region), sortValue: (row) => regionDisplay(row.region) },
    { key: 'temperature_type', label: '상/저온', width: 110 },
    { key: 'gross_area_py', label: '연면적(평)', align: 'right', render: (row) => formatNumber(row.gross_area_py || row.leasable_area_py, 1), sortValue: (row) => number(row.gross_area_py || row.leasable_area_py) },
    { key: 'rent_manwon_per_py', label: '임대료', align: 'right', render: (row) => formatManwon(row.rent_manwon_per_py, 1), sortValue: (row) => row.rent_manwon_per_py },
    { key: 'management_fee_manwon_per_py', label: '관리비', align: 'right', render: (row) => formatManwon(row.management_fee_manwon_per_py, 1), sortValue: (row) => row.management_fee_manwon_per_py },
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
  const updateModalFilter = (key, value) => {
    setModal((current) => (current ? {
      ...current,
      filters: {
        ...(current.filters || {}),
        [key]: value,
      },
    } : current));
  };
  const transactionExplorerRows = modal?.type === 'transaction-size-explorer'
    ? safeArray(modal.baseRows)
      .map((row) => ({
        ...row,
        size_bucket_label: transactionSizeBucketFor(row),
        temperature_label: transactionTemperatureFor(row),
      }))
      .filter((row) => !modal.filters?.year || modal.filters.year === '전체' || String(yearFrom(row)) === String(modal.filters.year))
      .filter((row) => regionMatches(modal.filters?.region || '전체', row.region))
      .filter((row) => !modal.filters?.bucket || modal.filters.bucket === '전체' || transactionSizeBucketFor(row) === modal.filters.bucket)
      .filter((row) => !modal.filters?.temp || modal.filters.temp === '전체' || transactionTemperatureFor(row) === modal.filters.temp)
      .filter((row) => {
        const dealType = text(row.transaction_type || row.deal_type, '');
        return !modal.filters?.dealType || modal.filters.dealType === '전체' || dealType === modal.filters.dealType;
      })
      .sort((a, b) => number(b.transaction_amount_krw) - number(a.transaction_amount_krw))
    : [];
  const leaseStatisticExplorerRows = modal?.type === 'lease-statistic-explorer'
    ? safeArray(modal.baseRows)
      .filter((row) => !modal.filters?.period || text(row.period_label) === modal.filters.period)
      .filter((row) => !modal.filters?.metric || text(row.metric_key) === modal.filters.metric)
      .filter((row) => text(row.dimension_type) === 'region')
      .filter((row) => row.is_average !== true)
      .filter((row) => !modal.filters?.segment || text(row.segment_label) === modal.filters.segment)
      .filter((row) => {
        const region = row.region || row.label;
        if (modal.filters?.scope === '수도권') return isCapitalRegion(region);
        if (modal.filters?.scope === '지방') return isLocalRegion(region);
        return true;
      })
      .filter((row) => regionMatches(modal.filters?.region || '전체', row.region || row.label))
      .sort((a, b) => regionDisplay(a.region || a.label).localeCompare(regionDisplay(b.region || b.label), 'ko') || number(b.value) - number(a.value))
    : [];
  const leaseStatisticModalPeriodOptions = [...new Set(safeArray(modal?.baseRows).map((row) => text(row.period_label, '')).filter(Boolean))]
    .sort((a, b) => periodSortValue(a) - periodSortValue(b));
  const leaseStatisticModalSegmentOptions = [...new Set(safeArray(modal?.baseRows).map((row) => text(row.segment_label, '')).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'ko'));
  const popupRows = modal?.type === 'lease-history'
    ? filteredLeaseHistoryRows
    : (modal?.type === 'transaction-size-explorer'
      ? transactionExplorerRows
      : (modal?.type === 'lease-statistic-explorer'
        ? leaseStatisticExplorerRows
        : (modal?.rows || (modal?.row ? [modal.row] : []))));
  return (
    <div
      className="w-full max-w-[1480px] mx-auto px-8 pt-8 pb-14"
      data-testid="market-data-dashboard"
      data-market-tab={currentTab}
    >
      <ModuleHeader
        eyebrow=""
        title={MARKET_TAB_TITLES[currentTab] || 'Market Data'}
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
              <ModuleHeader eyebrow="LEASE" title="권역별 최신 임대료" subtitle="최근 임대시장 통계 기준으로 상온·저온 구분과 수도권·지방 권역 차이를 비교합니다." />
              <div className="mb-4">
                <FilterPills label="상/저온 구분" value={overviewLeaseTemp} onChange={setOverviewLeaseTemp} options={overviewLeaseTempOptions} />
              </div>
              {overviewLeaseTemp === '전체' ? (
                <ScopedGroupedBarChart rows={overviewLeaseRentComparisonRows} formatter={(value) => `${formatNumber(value, 1)}만원`} onRowClick={openLeaseStatisticModal} />
              ) : (
                <ScopedBarList rows={overviewLeaseRentSelectedRows} formatter={(value) => `${formatNumber(value, 1)}만원`} color={chartSeriesColor(overviewLeaseTemp)} onRowClick={openLeaseStatisticModal} />
              )}
            </div>
            <div className={`${CARD} p-5`}>
              <ModuleHeader eyebrow="TRANSACTION" title="권역별 거래금액" subtitle="매매사례 거래금액 합계를 권역별로 비교합니다. 상/저온 필터는 같은 기준으로 차트를 다시 집계합니다." />
              <div className="mb-4">
                <FilterPills label="상/저온 구분" value={overviewTxnTemp} onChange={setOverviewTxnTemp} options={overviewTransactionTempOptions.map((item) => ({ value: item, label: item }))} />
              </div>
              <ScopedBarList rows={overviewTransactionRows} formatter={formatKrw} color={CHART_COLORS.primary} />
            </div>
            <div className={`${CARD} p-5 xl:col-span-2`}>
              <ModuleHeader eyebrow="SUPPLY" title="공급 예정 면적" />
              <SupplyAreaChart rows={overviewSupplyRows} seriesType="supply_period" title="공급 예정 시점" onPeriodClick={openSupplyPeriodModal} detailCountForPeriod={supplyDetailCountForPeriod} />
            </div>
          </section>
        </div>
      ) : null}

      {currentTab === 'transactions' ? (
        <div className="space-y-5">
          <section className={`${CARD} p-5`}>
            <ModuleHeader eyebrow="TRANSACTIONS" title="거래 사례 비교" subtitle="기간, 권역, 상/저온, 실물/선매입 조건을 적용한 거래 자산과 핵심 지표입니다." />
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
            <ModuleHeader
              eyebrow="TIME SERIES"
              title="2020년 이후 권역별 거래시장 규모"
              subtitle="세부권역별 연간 거래금액 합계입니다. y축은 2조 단위이며, 범례 선택 시 해당 권역만 강조됩니다."
              right={(
                <button
                  type="button"
                  onClick={() => setModal({
                    title: '2020년 이후 권역별 거래시장 규모 상세',
                    rows: transactionMarketAssetRows,
                    columns: transactionMarketAssetColumns,
                    width: 'max-w-[calc(100vw-32px)]',
                    minWidth: 1280,
                    maxHeight: 'calc(100vh - 150px)',
                    fullscreen: true,
                    defaultSort: [{ key: 'year', direction: 'asc' }, { key: 'transaction_amount_krw', direction: 'desc' }],
                  })}
                  className="h-9 rounded-[8px] border border-[#3A3A3C] px-3 text-[12px] font-semibold text-white hover:bg-white/5"
                >
                  세부 테이블 보기
                </button>
              )}
            />
            <StackedPeriodBarChart
              rows={transactionMarketChartRows}
              formatter={formatKrw}
              axisStep={2000000000000}
              legendPosition="bottom"
              legendAlign="center"
              colorFor={regionSeriesColor}
              height={390}
              showTotalLabels
              onPeriodClick={(period) => setModal({
                title: `${period}년 거래시장 규모 상세`,
                rows: transactionMarketAssetRows.filter((row) => String(row.year) === String(period)),
                columns: transactionMarketAssetColumns,
                width: 'max-w-[calc(100vw-32px)]',
                minWidth: 1280,
                maxHeight: 'calc(100vh - 150px)',
                fullscreen: true,
                defaultSort: { key: 'transaction_amount_krw', direction: 'desc' },
              })}
            />
          </section>
          <section className={`${CARD} p-5`}>
            <ModuleHeader eyebrow="SIZE ANALYSIS" title="규모별 평당 거래가 및 거래시장 규모" subtitle="권역, 시점, 규모 구간을 바꾸면 아래 두 차트가 함께 바뀝니다." />
            <div className="mb-5 grid grid-cols-1 gap-4 xl:grid-cols-4">
              <RegionFilterGroups label="권역" value={txnSizeRegion} onChange={setTxnSizeRegion} options={regions} />
              <FilterPills label="시점" value={txnSizePeriod} onChange={setTxnSizePeriod} options={transactionPeriodOptions.map((item) => ({ value: item, label: `${item}년` }))} />
              <FilterPills label="규모" value={txnSizeBucket} onChange={setTxnSizeBucket} options={transactionSizeOptions.map((item) => ({ value: item, label: item === '전체' ? '전체' : stripLeadingNumberLabel(item) }))} />
              <FilterPills label="상/저온" value={txnSizeTemp} onChange={setTxnSizeTemp} options={transactionSizeTempOptions} />
              <div className="xl:col-span-4 rounded-[10px] border border-[#333333] bg-[#171717] px-4 py-3 text-[12px] leading-5 text-[#A1A1AA]">{sizeBucketNote}</div>
            </div>
            <div className="grid grid-cols-1 gap-5">
              <div className="min-w-0">
                <div className="mb-2 text-[13px] font-semibold text-white">평당 거래가</div>
                <BarList rows={sizeUnitPriceChartRows} formatter={formatKrw} color={CHART_COLORS.secondary} onRowClick={(row) => openTransactionSizeModal(row, '평당 거래가')} />
              </div>
              <div className="min-w-0">
                <div className="mb-2 text-[13px] font-semibold text-white">거래시장 규모</div>
                <BarList rows={sizeMarketChartRows} formatter={formatKrw} color={CHART_COLORS.primary} onRowClick={(row) => openTransactionSizeModal(row, '거래시장 규모')} />
              </div>
            </div>
          </section>
          <section className={`${CARD} p-5`}>
            <ModuleHeader
              eyebrow="CAP RATE"
              title="Cap Rate 추이"
              subtitle="매매통계 시트의 Cap Rate 계열을 수도권·전국 기준으로 비교합니다. y축은 0~10% 범위입니다."
              right={(
                <button
                  type="button"
                  onClick={() => setModal({
                    title: 'Cap Rate 추이 상세',
                    rows: capRateTableRows,
                    columns: [
                      { key: 'label', label: '시점', width: 140 },
                      { key: 'series', label: '구분', width: 140 },
                      { key: 'bayesian', label: '베이지안', align: 'right', render: (row) => row.bayesian == null ? '-' : formatRate(row.bayesian), sortValue: (row) => number(row.bayesian) },
                      { key: 'general', label: '일반', align: 'right', render: (row) => row.general == null ? '-' : formatRate(row.general), sortValue: (row) => number(row.general) },
                      { key: 'weighted', label: '가중평균', align: 'right', render: (row) => row.weighted == null ? '-' : formatRate(row.weighted), sortValue: (row) => number(row.weighted) },
                    ],
                    width: 'max-w-[calc(100vw-32px)]',
                    minWidth: 720,
                    maxHeight: 'calc(100vh - 150px)',
                    fullscreen: true,
                    defaultSort: [{ key: 'label', direction: 'asc' }, { key: 'series', direction: 'asc' }],
                  })}
                  className="h-9 rounded-[8px] border border-[#3A3A3C] px-3 text-[12px] font-semibold text-white hover:bg-white/5"
                >
                  값 테이블 보기
                </button>
              )}
            />
            <MultiLineChart
              rows={capRateChartRows}
              formatter={formatRate}
              valueLabel="Cap Rate"
              yMin={0}
              yMax={0.1}
              yStep={0.02}
              splitPeriodAxis
              legendAlign="center"
              height={360}
              onPointClick={(row) => setModal({
                title: 'Cap Rate 추이 전체 상세',
                rows: capRateTableRows,
                columns: [
                  { key: 'label', label: '시점', width: 140 },
                  { key: 'series', label: '구분', width: 140 },
                  { key: 'bayesian', label: '베이지안', align: 'right', render: (item) => item.bayesian == null ? '-' : formatRate(item.bayesian), sortValue: (item) => number(item.bayesian) },
                  { key: 'general', label: '일반', align: 'right', render: (item) => item.general == null ? '-' : formatRate(item.general), sortValue: (item) => number(item.general) },
                  { key: 'weighted', label: '가중평균', align: 'right', render: (item) => item.weighted == null ? '-' : formatRate(item.weighted), sortValue: (item) => number(item.weighted) },
                ],
                width: 'max-w-[calc(100vw-32px)]',
                minWidth: 820,
                maxHeight: 'calc(100vh - 150px)',
                fullscreen: true,
                defaultSort: [{ key: 'label', direction: 'asc' }, { key: 'series', direction: 'asc' }],
              })}
            />
          </section>
        </div>
      ) : null}

      {currentTab === 'lease' ? (
        <div className="space-y-5">
          <section className={`${CARD} p-5`}>
            <ModuleHeader
              eyebrow="LEASE MARKET"
              title="최신 임대시장 통계"
              subtitle="임대시장 통계 시트의 선택 시점 기준입니다. 기본값은 복합 전체이며, 선택한 상/저온 구분을 수도권과 지방으로 나눠 비교합니다."
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
              <div className="xl:col-span-2 rounded-[10px] border border-[#333333] bg-[#171717] px-3 py-2 text-[12px] leading-5 text-[#A1A1AA]">
                복합 상온/저온은 복합센터 안의 온도별 관측치이고, 상온/저온(복합포함)은 단일 상온·저온과 복합센터 해당 온도 관측치를 함께 포함한 원천 집계입니다. 앱에서 임의 합산하지 않고 엑셀 원천 구분을 그대로 선택할 수 있게 두었습니다.
              </div>
            </div>
            <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-3">
              {leaseStatisticSummaryCards.map((metric) => (
                <MetricCard key={metric.label} label={metric.label} value={metric.value} detail={metric.detail} />
              ))}
            </div>
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              <div>
                <div className="mb-2 text-[13px] font-semibold text-white">수도권</div>
                <ScopedBarList rows={leaseStatisticCapitalChartRows.length ? leaseStatisticCapitalChartRows : leaseStatisticChartRows} formatter={leaseMetricFormatter} color={CHART_COLORS.primary} onRowClick={openLeaseStatisticModal} />
              </div>
              <div>
                <div className="mb-2 text-[13px] font-semibold text-white">지방</div>
                <ScopedBarList rows={leaseStatisticLocalChartRows.length ? leaseStatisticLocalChartRows : leaseStatisticChartRows} formatter={leaseMetricFormatter} color={CHART_COLORS.secondary} onRowClick={openLeaseStatisticModal} />
              </div>
            </div>
            <div className="mt-5">
              <SortableTable
                minWidth={920}
                maxHeight={340}
                stickyCount={1}
                defaultSort={{ key: 'value', direction: 'desc' }}
                columns={leaseStatisticTableColumns}
                rows={leaseStatisticDisplayRows}
                onRowClick={openLeaseStatisticModal}
              />
            </div>
            {!leaseStatisticRows.length ? (
              <div className="mt-3 rounded-[8px] border border-[#5A4420] bg-[#2A2115] px-3 py-2 text-[12px] text-[#FFD479]">
                엑셀 임대시장 통계 요약값을 API에서 아직 받지 못했습니다. 원자료 기준 임시 집계가 아니라 QA 실패로 처리됩니다.
              </div>
            ) : null}
          </section>
          <section className={`${CARD} p-5`}>
            <ModuleHeader eyebrow="CENTER DETAIL" title="권역별 물류센터 임대 현황" subtitle="임대시장 현황 시트의 센터별 관측치입니다. 행을 선택하면 같은 센터의 시점별 기록을 확인합니다." />
            <div className="mb-4">
              <FilterPills label="상/저온 구분" value={leaseCenterTemp} onChange={setLeaseCenterTemp} options={leaseCenterTempOptions} />
            </div>
            <div className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]">
              <RegionFilterGroups label="권역" value={leaseRegion} onChange={setLeaseRegion} options={regions} />
              <div className={`${INNER} flex min-h-[74px] items-center px-4 text-[12px] leading-5 text-[#A1A1AA]`}>
                권역과 상/저온 조건은 지도와 표에 동시에 반영됩니다. 자산명 검색은 우측 표 바로 위에서 조정합니다.
              </div>
            </div>
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(420px,0.75fr)_minmax(560px,1.25fr)]">
              <MarketMapPanel title="권역별 센터" rows={filteredLeaseRows} labelKey="center_name" onSelect={(row) => setModal({ title: text(row.center_name), rows: centerHistoryRows(row), columns: leaseHistoryColumns, width: 'max-w-[calc(100vw-32px)]', minWidth: 1320, maxHeight: 680 })} />
              <div className="min-w-0 space-y-3">
                <label className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#86868B]">
                  자산 검색
                  <input value={leaseSearch} onChange={(event) => setLeaseSearch(event.target.value)} className="mt-2 h-9 w-full rounded-[8px] border border-[#3A3A3C] bg-[#171717] px-3 text-[12px] text-white outline-none" placeholder="센터명 또는 주소" />
                </label>
                <SortableTable minWidth={1040} maxHeight={540} stickyCount={2} defaultSort={{ key: 'gross_area_py', direction: 'desc' }} columns={leaseColumns} rows={filteredLeaseRows} onRowClick={(row) => setModal({ title: text(row.center_name), rows: centerHistoryRows(row), columns: leaseHistoryColumns, width: 'max-w-[calc(100vw-32px)]', minWidth: 1320, maxHeight: 680 })} />
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {currentTab === 'supply' ? (
        <div className="space-y-5">
          <section className={`${CARD} p-5`}>
            <ModuleHeader eyebrow="NEW SUPPLY" title="최근 신규 공급 사례" subtitle="당분기 신규공급 사례 기준으로 지도 위치와 자산별 공급 면적을 함께 확인합니다." />
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(420px,0.75fr)_minmax(560px,1.25fr)]">
              <MarketMapPanel title="당분기 신규공급" rows={newSupplyRows} labelKey="center_name" onSelect={(row) => setModal({ title: text(row.center_name), row, columns: supplyColumns })} />
              <SortableTable minWidth={980} maxHeight={580} stickyCount={2} defaultSort={{ key: 'gross_area_py', direction: 'desc' }} columns={supplyColumns} rows={newSupplyRows} onRowClick={(row) => setModal({ title: text(row.center_name), row, columns: supplyColumns })} />
            </div>
          </section>
          <section className={`${CARD} p-5`}>
            <ModuleHeader eyebrow="PIPELINE" title="공급 예정 물량" subtitle="공급 예정 물량 구분 시트 기준입니다. 기간 선택은 지도, 표, 차트 결과에 동시에 적용됩니다." />
            <div className="mb-4">
              <div className="mb-3 grid grid-cols-1 gap-4 xl:grid-cols-[320px_1fr] xl:items-start">
                <FilterPills label="유형" value={supplyKind} onChange={setSupplyKind} options={supplyKindOptions} />
                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="text-[12px] font-semibold text-[#A1A1AA]">기간 선택</div>
                    <div className="flex items-center gap-2">
                      <div className="text-[11px] text-[#86868B]">{supplyStart} ~ {supplyEnd} · {formatNumber(rangedPipelineRows.length)}건{supplyPeriodTouched ? ' · 미정 제외' : ''}</div>
                      <button
                        type="button"
                        onClick={() => {
                          setSupplyStart(SUPPLY_PERIOD_DEFAULT_START);
                          setSupplyEnd(SUPPLY_PERIOD_DEFAULT_END);
                          setSupplyPeriodTouched(false);
                        }}
                        className="h-8 rounded-[8px] border border-[#3A3A3C] px-3 text-[11px] font-semibold text-[#D1D1D6] hover:border-[#5A5A5C] hover:bg-[#2A2A29]"
                      >
                        기간 초기화
                      </button>
                    </div>
                  </div>
                  <div className={`${INNER} grid grid-cols-1 gap-2 p-3 md:grid-cols-2`}>
                    <input
                      type="date"
                      value={supplyStart}
                      onChange={(event) => {
                        setSupplyPeriodTouched(true);
                        setSupplyStart(event.target.value);
                      }}
                      className="h-9 rounded-[8px] border border-[#3A3A3C] bg-[#171717] px-3 text-[12px] text-white outline-none"
                      aria-label="공급 시작일"
                    />
                    <input
                      type="date"
                      value={supplyEnd}
                      onChange={(event) => {
                        setSupplyPeriodTouched(true);
                        setSupplyEnd(event.target.value);
                      }}
                      className="h-9 rounded-[8px] border border-[#3A3A3C] bg-[#171717] px-3 text-[12px] text-white outline-none"
                      aria-label="공급 종료일"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(420px,0.75fr)_minmax(560px,1.25fr)]">
              <MarketMapPanel title="공급 예정 지도" rows={rangedPipelineRows} labelKey="center_name" onSelect={(row) => setModal({ title: text(row.center_name), row, columns: supplyColumns })} />
              <SortableTable minWidth={980} maxHeight={580} stickyCount={2} defaultSort={{ key: 'expected_year', direction: 'asc' }} columns={supplyColumns} rows={rangedPipelineRows} onRowClick={(row) => setModal({ title: text(row.center_name), row, columns: supplyColumns })} />
            </div>
            <div className="mt-5">
              <SupplyAreaChart rows={supplyChartRowsInRange} seriesType="pipeline_supply" title="향후 공급 예정 물량" axisTickMode="five-lines" onPeriodClick={openSupplyPeriodModal} detailCountForPeriod={supplyDetailCountForPeriod} />
            </div>
          </section>
          <section className={`${CARD} p-5`}>
            <ModuleHeader eyebrow="CUMULATIVE" title="2024년 이후 누적 신규공급 사례" subtitle="2024년 이후 신규공급 누적 기준으로 지도와 상세 표를 확인합니다." />
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(420px,0.75fr)_minmax(560px,1.25fr)]">
              <MarketMapPanel title="누적 신규공급" rows={cumulativeNewRows} labelKey="center_name" onSelect={(row) => setModal({ title: text(row.center_name), row, columns: supplyColumns })} />
              <SortableTable minWidth={980} maxHeight={580} stickyCount={2} defaultSort={{ key: 'gross_area_py', direction: 'desc' }} columns={supplyColumns} rows={cumulativeNewRows} onRowClick={(row) => setModal({ title: text(row.center_name), row, columns: supplyColumns })} />
            </div>
            <div className="mt-5">
              <SupplyAreaChart rows={supplyChartRowsInRange} seriesType="cumulative_supply" title="누적 공급 면적" axisTickMode="five-lines" onPeriodClick={openSupplyPeriodModal} detailCountForPeriod={supplyDetailCountForPeriod} />
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

      <Modal title={modal?.title} onClose={() => setModal(null)} width={modal?.width || 'max-w-[1180px]'} fullscreen={modal?.fullscreen}>
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
        {modal?.type === 'transaction-size-explorer' ? (
          <div data-testid="transaction-size-explorer" className="mb-4 space-y-4">
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
              <FilterPills label="연도" value={modal.filters?.year || '전체'} onChange={(value) => updateModalFilter('year', value)} options={['전체', ...transactionPeriodOptions].map((item) => ({ value: item, label: item === '전체' ? '전체' : `${item}년` }))} />
              <RegionFilterGroups label="권역" value={modal.filters?.region || '전체'} onChange={(value) => updateModalFilter('region', value)} options={regions} />
              <FilterPills label="규모" value={modal.filters?.bucket || '전체'} onChange={(value) => updateModalFilter('bucket', value)} options={transactionSizeOptions.map((item) => ({ value: item, label: item === '전체' ? '전체' : stripLeadingNumberLabel(item) }))} />
              <FilterPills label="상/저온" value={modal.filters?.temp || '전체'} onChange={(value) => updateModalFilter('temp', value)} options={transactionSizeTempOptions} />
              <FilterPills label="거래유형" value={modal.filters?.dealType || '전체'} onChange={(value) => updateModalFilter('dealType', value)} options={transactionTypes.map((item) => ({ value: item, label: item }))} />
            </div>
            <div className={`${INNER} px-3 py-2 text-[12px] text-[#A1A1AA]`}>
              선택 조건에 맞는 자산별 거래 내역 {formatNumber(transactionExplorerRows.length)}건을 표시합니다. 규모는 원본 분류가 아니라 연면적 기준으로 다시 계산합니다.
            </div>
          </div>
        ) : null}
        {modal?.type === 'lease-statistic-explorer' ? (
          <div data-testid="lease-statistic-explorer" className="mb-4 space-y-4">
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr_1.3fr]">
              <FilterPills label="시점" value={modal.filters?.period || selectedLeaseStatisticPeriod} onChange={(value) => updateModalFilter('period', value)} options={leaseStatisticModalPeriodOptions.map((period) => ({ value: period, label: period }))} />
              <FilterPills label="지표" value={modal.filters?.metric || leaseMeasure} onChange={(value) => updateModalFilter('metric', value)} options={leaseMeasureOptions} />
              <FilterPills label="상/저온 구분" value={modal.filters?.segment || leaseSegment} onChange={(value) => updateModalFilter('segment', value)} options={leaseStatisticModalSegmentOptions.map((segment) => ({ value: segment, label: segment }))} />
            </div>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[320px_1fr]">
              <FilterPills label="수도권/지방" value={modal.filters?.scope || '전체'} onChange={(value) => updateModalFilter('scope', value)} options={['전체', '수도권', '지방']} />
              <RegionFilterGroups label="세부 권역" value={modal.filters?.region || '전체'} onChange={(value) => updateModalFilter('region', value)} options={regions} />
            </div>
            <div className={`${INNER} px-3 py-2 text-[12px] text-[#A1A1AA]`}>
              선택 조건에 맞는 권역별 통계 {formatNumber(leaseStatisticExplorerRows.length)}건을 표시합니다.
            </div>
          </div>
        ) : null}
        {modal?.type === 'supply-area-value-explorer' ? (
          <div data-testid="supply-area-value-explorer" className={`${INNER} mb-4 px-3 py-2 text-[12px] text-[#A1A1AA]`}>
            선택한 시점의 권역별 누적 공급 면적 전체 값 {formatNumber(popupRows.length)}건을 표시합니다.
          </div>
        ) : null}
        <SortableTable
          minWidth={modal?.minWidth || 1180}
          maxHeight={modal?.maxHeight || 620}
          stickyCount={2}
          defaultSort={modal?.defaultSort}
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
          <ModuleHeader eyebrow="LOAN MATURITY" title="대출 만기 일정" subtitle="대출 tranche 기준 만기월과 만기금액만 표시합니다." />
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
  const summary = data?.summary || {};
  const rows = useMemo(() => (mode === 'fund' ? funds : assets)
    .slice()
    .sort((a, b) => (
      number(b.total_capital_krw) - number(a.total_capital_krw)
    )), [assets, funds, mode]);
  const fundBasisTotals = {
    equity: number(summary.funds?.equity_krw) || funds.reduce((sum, row) => sum + number(row.equity_krw), 0),
    loan: number(summary.funds?.loan_krw) || funds.reduce((sum, row) => sum + number(row.loan_krw), 0),
  };
  const assetBasisReferenceTotal = number(summary.assets?.reference_total_capital_krw);
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
      const assetKey = text(detailTarget.row?.asset_match_key, detailTarget.row?.asset_display_label);
      return loanRateBaseRows
        .filter((row) => text(row.asset_match_key, row.asset_display_label) === assetKey)
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
        <MetricCard label="Equity" value={formatKrw(fundBasisTotals.equity)} detail="펀드 기준 전체 합계" />
        <MetricCard label="Loan" value={formatKrw(fundBasisTotals.loan)} detail="펀드 기준 전체 합계" />
        <MetricCard label="합계" value={formatKrw(fundBasisTotals.equity + fundBasisTotals.loan)} detail="Equity + Loan" />
      </section>
      <section className={`${CARD} p-5`}>
        <ModuleHeader
          eyebrow="CAPITAL STACK"
          title={mode === 'fund' ? '펀드별 Equity / Loan 구성' : '자산별 Equity / Loan 구성'}
          subtitle={mode === 'asset' && assetBasisReferenceTotal ? '공동펀드는 중복 합산하지 않고 자산별 확정 배분 금액만 표시합니다.' : '합계 금액 기준 내림차순'}
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
            onRowClick={(row) => setDetailTarget({ type: 'loan-rate-asset', row })}
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
            defaultSort={detailTarget?.type === 'loan-rate-asset'
              ? [{ key: 'tranche_display', direction: 'asc' }, { key: 'amount_krw', direction: 'desc' }]
              : { key: 'amount_krw', direction: 'desc' }}
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
        <ModuleHeader eyebrow="ASSET SPEC" title="자산별 스펙 비교" subtitle="주요 물류센터 스펙 비교 시트 기준으로 자산별 항목을 비교합니다." />
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
  const assets = safeArray(specRead.data?.assets);
  const specs = safeArray(specRead.data?.specs);
  const files = safeArray(specRead.data?.files);
  const tenantSummary = safeArray(specRead.data?.tenant_summary);
  const specsByAsset = new Map(specs.map((row) => [row.asset_id, row]));
  const filesByAsset = new Map();
  files.forEach((row) => filesByAsset.set(row.asset_id, (filesByAsset.get(row.asset_id) || 0) + 1));
  const tenantsByAsset = new Map();
  tenantSummary.forEach((row) => {
    const assetRows = tenantsByAsset.get(row.asset_id) || [];
    assetRows.push(row);
    tenantsByAsset.set(row.asset_id, assetRows);
  });
  const rows = assets.map((asset) => ({
    ...asset,
    spec: specsByAsset.get(asset.asset_id) || {},
    file_count: filesByAsset.get(asset.asset_id) || 0,
    tenants: tenantsByAsset.get(asset.asset_id) || [],
  })).sort((a, b) => text(a.asset_name).localeCompare(text(b.asset_name), 'ko'));
  const editableAssets = rows.filter((row) => row.can_create || row.can_update || row.can_delete);
  const [assetCompareIds, setAssetCompareIds] = useState(() => Array.from({ length: ASSET_SPEC_COMPARE_SLOT_COUNT }, () => ''));
  const [tenantCompareSelections, setTenantCompareSelections] = useState(() => Array.from(
    { length: ASSET_SPEC_COMPARE_SLOT_COUNT },
    () => ({ tenantName: '', assetId: '' }),
  ));
  const [editOpen, setEditOpen] = useState(false);
  const [editAssetId, setEditAssetId] = useState('');
  const [editRows, setEditRows] = useState(ASSET_SPEC_DEFAULT_ROWS);
  const [editStatus, setEditStatus] = useState(null);
  const [tableModal, setTableModal] = useState(null);
  const tenantRows = tenantSummary.map((tenant) => {
    const asset = rows.find((row) => row.asset_id === tenant.asset_id) || {};
    return {
      id: `${tenant.asset_id}:${tenant.tenant_name}`,
      asset_id: tenant.asset_id,
      tenant_name: tenant.tenant_name,
      asset_name: asset.asset_name,
      asset_row: asset,
      region: asset.region || asset.capital_region || asset.national_region || asset.region_group || asset.spec?.region,
      leased_area_sqm: tenant.leased_area_sqm,
      temperature_type: asset.spec?.temperature_type,
      clear_height_m: asset.spec?.clear_height_m,
      corridor_width_m: asset.spec?.corridor_width_m || asset.spec?.aisle_width_m,
      ramp_width_m: asset.spec?.ramp_width_m,
      floor_load: [asset.spec?.floor_load_warehouse_kg_sqm, asset.spec?.floor_load_corridor_kg_sqm].filter(Boolean).join(' / '),
    };
  }).sort((a, b) => text(a.tenant_name).localeCompare(text(b.tenant_name), 'ko') || text(a.asset_name).localeCompare(text(b.asset_name), 'ko'));
  const rowsVersion = rows.map((row) => `${row.asset_id}:${row.spec?.asset_spec_id || ''}:${row.spec?.updated_at || ''}`).join('|');
  const tenantRowsVersion = tenantRows.map((row) => row.id).join('|');
  const editableAssetsVersion = editableAssets.map((row) => `${row.asset_id}:${row.can_create ? 'c' : ''}${row.can_update ? 'u' : ''}${row.can_delete ? 'd' : ''}`).join('|');
  const tenantNames = useMemo(() => (
    Array.from(new Set(tenantRows.map((row) => text(row.tenant_name, '')).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, 'ko'))
  ), [tenantRowsVersion]);
  const tenantAssetsByName = useMemo(() => {
    const grouped = new Map();
    tenantRows.forEach((row) => {
      const tenantName = text(row.tenant_name, '');
      if (!tenantName) return;
      const current = grouped.get(tenantName) || [];
      if (!current.some((item) => item.asset_id === row.asset_id)) current.push(row);
      grouped.set(tenantName, current);
    });
    grouped.forEach((items) => items.sort((a, b) => text(a.asset_name).localeCompare(text(b.asset_name), 'ko')));
    return grouped;
  }, [tenantRowsVersion]);
  useEffect(() => {
    if (!rows.length) return;
    setAssetCompareIds((current) => {
      let changed = current.length !== ASSET_SPEC_COMPARE_SLOT_COUNT;
      const next = Array.from({ length: ASSET_SPEC_COMPARE_SLOT_COUNT }, (_, index) => {
        const currentId = current[index] || '';
        if (rows.some((row) => row.asset_id === currentId)) return currentId;
        changed = true;
        return rows[index]?.asset_id || rows[0]?.asset_id || '';
      });
      return changed ? next : current;
    });
  }, [rowsVersion]);
  useEffect(() => {
    if (!tenantRows.length) return;
    setTenantCompareSelections((current) => {
      let changed = current.length !== ASSET_SPEC_COMPARE_SLOT_COUNT;
      const next = Array.from({ length: ASSET_SPEC_COMPARE_SLOT_COUNT }, (_, index) => {
        const currentSelection = current[index] || {};
        let tenantName = currentSelection.tenantName || '';
        if (!tenantNames.includes(tenantName)) {
          tenantName = tenantNames[index] || tenantNames[0] || '';
          changed = true;
        }
        const occupiedAssets = tenantAssetsByName.get(tenantName) || [];
        let assetId = currentSelection.assetId || '';
        if (!occupiedAssets.some((row) => row.asset_id === assetId)) {
          assetId = occupiedAssets[index]?.asset_id || occupiedAssets[0]?.asset_id || '';
          changed = true;
        }
        const nextSelection = { tenantName, assetId };
        if (tenantName !== currentSelection.tenantName || assetId !== currentSelection.assetId) changed = true;
        return nextSelection;
      });
      return changed ? next : current;
    });
  }, [tenantRowsVersion, tenantNames, tenantAssetsByName]);
  useEffect(() => {
    if (!editOpen) return;
    const fallbackAssetId = editableAssets[0]?.asset_id || '';
    if (!editableAssets.some((row) => row.asset_id === editAssetId)) setEditAssetId(fallbackAssetId);
  }, [editableAssetsVersion, editAssetId, editOpen]);
  useEffect(() => {
    if (!editOpen) return;
    const selected = rows.find((row) => row.asset_id === editAssetId);
    setEditRows(normalizeAssetSpecEditorRows(selected ? assetSpecRowsFor(selected) : ASSET_SPEC_DEFAULT_ROWS));
    setEditStatus(null);
  }, [editAssetId, editOpen, rowsVersion]);
  const assetCompareTargets = assetCompareIds.map((assetId, index) => (
    rows.find((row) => row.asset_id === assetId) || rows[index] || rows[0] || null
  ));
  const assetCompareLabels = assetCompareTargets.map((row, index) => text(row?.asset_name, `비교 ${index + 1}`));
  const tenantCompareTargets = tenantCompareSelections.map((selection) => {
    const occupiedAssets = tenantAssetsByName.get(selection.tenantName) || [];
    return occupiedAssets.find((row) => row.asset_id === selection.assetId) || occupiedAssets[0] || null;
  });
  const tenantCompareLabels = tenantCompareTargets.map((row, index) => (
    row ? `${text(row.tenant_name)} · ${text(row.asset_name)}` : `비교 ${index + 1}`
  ));
  const specCompareRows = assetSpecComparisonRows(assetCompareTargets);
  const tenantCompareRows = assetSpecComparisonRows(tenantCompareTargets.map((row) => row?.asset_row));
  const compareColumns = (labels) => [
    { key: 'row_number', label: '행', width: 72, align: 'right', sortValue: (row) => number(row.row_number) },
    { key: 'label', label: '항목', width: 210, noTruncate: true },
    ...safeArray(labels).slice(0, ASSET_SPEC_COMPARE_SLOT_COUNT).map((label, index) => ({
      key: `value_${index}`,
      label: label || `비교 ${index + 1}`,
      width: 260,
      noTruncate: true,
      wrap: true,
      render: (row) => formatSpecComparisonValue(row.values?.[index] ?? row[`value_${index}`]),
    })),
  ];
  const setAssetCompareId = (index, assetId) => {
    setAssetCompareIds((current) => current.map((value, currentIndex) => (currentIndex === index ? assetId : value)));
  };
  const setTenantCompareTenant = (index, tenantName) => {
    const occupiedAssets = tenantAssetsByName.get(tenantName) || [];
    setTenantCompareSelections((current) => current.map((selection, currentIndex) => (
      currentIndex === index
        ? { tenantName, assetId: occupiedAssets[0]?.asset_id || '' }
        : selection
    )));
  };
  const setTenantCompareAsset = (index, assetId) => {
    setTenantCompareSelections((current) => current.map((selection, currentIndex) => (
      currentIndex === index ? { ...selection, assetId } : selection
    )));
  };
  const selectedEditAsset = rows.find((row) => row.asset_id === editAssetId) || null;
  const canSaveSelectedSpec = Boolean(selectedEditAsset && (
    selectedEditAsset.spec?.asset_spec_id ? selectedEditAsset.can_update : selectedEditAsset.can_create
  ));
  const setEditValue = (rowNumber, value) => {
    setEditRows((current) => current.map((row) => (
      number(row.row_number) === number(rowNumber) ? { ...row, value } : row
    )));
  };
  const saveAssetSpec = async () => {
    if (!selectedEditAsset) return;
    setEditStatus({ type: 'loading', message: '저장 중입니다.' });
    try {
      const saved = await invoke('asset-spec/save', {
        asset_id: selectedEditAsset.asset_id,
        rows: editRows,
      });
      setEditStatus({ type: 'success', message: `저장 완료 · readback ${saved?.readback_ok ? '확인' : '대기'}` });
      await specRead.reload({}, { force: true });
    } catch (error) {
      setEditStatus({ type: 'warning', message: `저장 실패: ${error.message || '권한 또는 Supabase 반영 상태를 확인해야 합니다.'}` });
    }
  };
  const deleteAssetSpec = async () => {
    if (!selectedEditAsset) return;
    setEditStatus({ type: 'loading', message: '삭제 중입니다.' });
    try {
      const saved = await invoke('asset-spec/save', {
        asset_id: selectedEditAsset.asset_id,
        mode: 'delete',
      });
      setEditRows(normalizeAssetSpecEditorRows([]));
      setEditStatus({ type: 'success', message: `삭제 완료 · readback ${saved?.readback_ok ? '확인' : '대기'}` });
      await specRead.reload({}, { force: true });
    } catch (error) {
      setEditStatus({ type: 'warning', message: `삭제 실패: ${error.message || '권한 또는 Supabase 반영 상태를 확인해야 합니다.'}` });
    }
  };
  return (
    <div className="space-y-5">
      {specRead.error ? <div className="rounded-[12px] border border-[#5A4420] bg-[#2A2115] px-4 py-3 text-[13px] text-[#FFD479]">{specRead.error}</div> : null}
      <button
        type="button"
        onClick={() => setEditOpen(true)}
        className="flex min-h-[58px] w-full items-center justify-center rounded-[14px] border border-[#3b82f6]/40 bg-[#1f3763] px-5 text-[15px] font-bold text-[#CFE1FF] transition-colors hover:bg-[#284B87]"
      >
        자산 스펙 데이터 입력 및 수정
      </button>
      <section className={`${CARD} p-5`}>
        <ModuleHeader eyebrow="ASSET SPEC" title="자산별 스펙 비교" subtitle="비교할 자산을 최대 4개까지 선택해 샘플 엑셀의 5~53행 기준으로 나란히 확인합니다." />
        <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-4">
          {assetCompareIds.map((assetId, index) => (
            <label key={`asset-compare-${index}`} className="block min-w-0">
              <span className="mb-1 block text-[12px] font-semibold text-[#A1A1AA]">비교 {index + 1}</span>
              <select value={assetId} onChange={(event) => setAssetCompareId(index, event.target.value)} className="h-10 w-full rounded-[8px] border border-[#3A3A3C] bg-[#171717] px-3 text-[13px] font-semibold text-white outline-none">
                {rows.map((row) => <option key={row.asset_id} value={row.asset_id}>{row.asset_name}</option>)}
              </select>
            </label>
          ))}
        </div>
        <SpecComparisonPanel rows={specCompareRows} labels={assetCompareLabels} />
        <button type="button" onClick={() => setTableModal({ title: '자산 스펙 전체 테이블', rows: specCompareRows, columns: compareColumns(assetCompareLabels), minWidth: 1322 })} className="mt-4 h-10 w-full rounded-[9px] border border-[#3A3A3C] px-4 text-[13px] font-semibold text-[#E5E5E5] hover:bg-white/[0.04]">테이블 보기</button>
      </section>
      <section className={`${CARD} p-5`}>
        <ModuleHeader eyebrow="TENANT SPEC FIT" title="임차인별 점유 자산 스펙 비교" subtitle="선택한 임차인의 점유 자산 스펙을 같은 항목 기준으로 최대 4개까지 비교합니다." />
        <div className="mb-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
            {tenantCompareSelections.map((selection, index) => (
              <label key={`tenant-compare-tenant-${index}`} className="block min-w-0">
                <span className="mb-1 block text-[12px] font-semibold text-[#A1A1AA]">비교 {index + 1} 임차인</span>
                <select value={selection.tenantName} onChange={(event) => setTenantCompareTenant(index, event.target.value)} className="h-10 w-full rounded-[8px] border border-[#3A3A3C] bg-[#171717] px-3 text-[13px] font-semibold text-white outline-none">
                  {tenantNames.map((tenantName) => <option key={tenantName} value={tenantName}>{tenantName}</option>)}
                </select>
              </label>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
            {tenantCompareSelections.map((selection, index) => {
              const occupiedAssets = tenantAssetsByName.get(selection.tenantName) || [];
              return (
                <label key={`tenant-compare-asset-${index}`} className="block min-w-0">
                  <span className="mb-1 block text-[12px] font-semibold text-[#A1A1AA]">점유 자산</span>
                  <select value={selection.assetId} onChange={(event) => setTenantCompareAsset(index, event.target.value)} className="h-10 w-full rounded-[8px] border border-[#3A3A3C] bg-[#171717] px-3 text-[13px] font-semibold text-white outline-none">
                    {occupiedAssets.map((row) => <option key={row.asset_id} value={row.asset_id}>{row.asset_name}</option>)}
                  </select>
                </label>
              );
            })}
          </div>
        </div>
        <SpecComparisonPanel
          rows={tenantCompareRows}
          labels={tenantCompareLabels}
          empty="아직 임차인별 스펙 비교 데이터가 없습니다."
        />
        <button
          type="button"
          onClick={() => setTableModal({
            title: '임차인별 점유 자산 스펙 전체 테이블',
            rows: tenantCompareRows,
            columns: compareColumns(tenantCompareLabels),
            minWidth: 1322,
          })}
          className="mt-4 h-10 w-full rounded-[9px] border border-[#3A3A3C] px-4 text-[13px] font-semibold text-[#E5E5E5] hover:bg-white/[0.04]"
        >
          테이블 보기
        </button>
      </section>
      <Modal title={editOpen ? '자산 스펙 데이터 입력' : ''} onClose={() => setEditOpen(false)} width="max-w-[calc(100vw-32px)]" fullscreen>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-end">
            <label className="block">
              <span className="mb-1 block text-[12px] font-semibold text-[#A1A1AA]">자산 선택</span>
              <select value={editAssetId} onChange={(event) => setEditAssetId(event.target.value)} className="h-10 w-full rounded-[8px] border border-[#3A3A3C] bg-[#171717] px-3 text-[13px] font-semibold text-white outline-none">
                {editableAssets.length ? editableAssets.map((row) => <option key={row.asset_id} value={row.asset_id}>{row.asset_name}</option>) : <option value="">수정 권한이 있는 자산 없음</option>}
              </select>
            </label>
            <button type="button" disabled={!canSaveSelectedSpec} onClick={saveAssetSpec} className="h-10 rounded-[9px] bg-[#2F6BFF] px-5 text-[13px] font-semibold text-white hover:bg-[#3E7BFF] disabled:cursor-not-allowed disabled:opacity-40">Supabase 저장</button>
            <button type="button" disabled={!selectedEditAsset?.can_delete} onClick={deleteAssetSpec} className="h-10 rounded-[9px] border border-[#5A4420] px-5 text-[13px] font-semibold text-[#FFD479] hover:bg-[#2A2115] disabled:cursor-not-allowed disabled:opacity-40">선택 자산 스펙 삭제</button>
          </div>
          {editStatus ? <div className={`rounded-[10px] border px-4 py-3 text-[13px] ${editStatus.type === 'success' ? 'border-[#2F6B3C] bg-[#152A1A] text-[#A7F3D0]' : editStatus.type === 'loading' ? 'border-[#34547A] bg-[#142033] text-[#BFD7FF]' : 'border-[#5A4420] bg-[#2A2115] text-[#FFD479]'}`}>{editStatus.message}</div> : null}
          <div className="custom-scrollbar max-h-[calc(100vh-260px)] overflow-auto rounded-[12px] border border-[#333333]">
            <table className="w-full min-w-[980px] border-collapse text-left text-[12px]">
              <thead className="sticky top-0 z-10 bg-[#1F1F1E] text-[#A1A1AA]">
                <tr>
                  <th className="w-[72px] px-3 py-2 text-right font-semibold">행</th>
                  <th className="w-[240px] px-3 py-2 font-semibold">항목</th>
                  <th className="px-3 py-2 font-semibold">값</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#303033]">
                {editRows.map((row) => (
                  <tr key={row.row_number} className="bg-[#171717] text-[#E5E5E5]">
                    <td className="px-3 py-2 text-right text-[#A1A1AA]">{row.row_number}</td>
                    <td className="px-3 py-2 font-semibold">{row.label}</td>
                    <td className="px-3 py-2">
                      <textarea value={text(row.value, '')} onChange={(event) => setEditValue(row.row_number, event.target.value)} className="min-h-[36px] w-full resize-y rounded-[8px] border border-[#3A3A3C] bg-[#111111] px-3 py-2 text-[12px] text-white outline-none focus:border-[#7DD3FC]" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>
      <Modal title={tableModal?.title || ''} onClose={() => setTableModal(null)} width="max-w-[calc(100vw-32px)]" fullscreen>
        <SortableTable minWidth={tableModal?.minWidth || 1180} maxHeight="calc(100vh - 150px)" stickyCount={2} defaultSort={{ key: 'row_number', direction: 'asc' }} columns={tableModal?.columns || []} rows={tableModal?.rows || []} />
      </Modal>
    </div>
  );
}

const MANAGEMENT_ALL_OPTION = '전체';

function DataManagementDashboardLegacy() {
  const [tab, setTab] = useState('lease');
  const [selectedRowId, setSelectedRowId] = useState('');
  const [selectedField, setSelectedField] = useState('');
  const [afterValue, setAfterValue] = useState('');
  const [reason, setReason] = useState('');
  const [selectedEditRequestId, setSelectedEditRequestId] = useState('');
  const [managementAsset, setManagementAsset] = useState(MANAGEMENT_ALL_OPTION);
  const [managementFund, setManagementFund] = useState(MANAGEMENT_ALL_OPTION);
  const [managementSearch, setManagementSearch] = useState('');
  const [gridDrafts, setGridDrafts] = useState({});
  const [gridReason, setGridReason] = useState('');
  const [submitStatus, setSubmitStatus] = useState(null);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const { loading, error, data, reload } = useEdgeData('data-management/status', { limit: 100, row_limit: 800 }, []);
  const sources = safeArray(data?.sources);
  const sourceRows = safeArray(data?.source_rows);
  const edits = safeArray(data?.edit_requests);
  const domainStats = safeArray(data?.domain_stats);
  const tabs = [
    { id: 'my', label: '이지스 전체' },
    { id: 'lease', label: '임대차' },
    { id: 'fund', label: '펀드/금융' },
    { id: 'permission', label: '권한/사용자' },
    { id: 'spec', label: '자산 스펙' },
    { id: 'cost', label: '운영비용' },
    { id: 'market', label: '시장 Data' },
    { id: 'approval', label: '승인 대기' },
    { id: 'history', label: '반영 이력' },
  ];
  const domainForTab = {
    my: '',
    lease: 'lease_contracts',
    fund: 'fund_info',
    market: 'sector_market',
    permission: 'permissions',
    spec: 'asset_specs',
    cost: 'operating_costs',
  }[tab];
  const tabForDomain = (domain) => ({
    lease_contracts: 'lease',
    fund_info: 'fund',
    sector_market: 'market',
    permissions: 'permission',
    asset_specs: 'spec',
    operating_costs: 'cost',
  }[domain] || 'lease');
  const domainRows = domainForTab
    ? sourceRows.filter((row) => sources.find((source) => source.source_file_id === row.source_file_id)?.source_domain === domainForTab)
    : sourceRows.filter((row) => {
      const domain = sources.find((source) => source.source_file_id === row.source_file_id)?.source_domain;
      return DATA_MANAGEMENT_DOMAIN_KEYS.has(domain) && domain !== 'sector_market';
    });
  const rowOptionValue = (row, keys) => {
    const values = row?.row_values && typeof row.row_values === 'object' ? row.row_values : {};
    return text(firstText(...keys.map((key) => values[key])), '');
  };
  const assetKeys = ['자산명', '물류센터명', '센터명', '창고명', 'asset_name', 'center_name', 'warehouse_name'];
  const fundKeys = ['펀드명', 'fund_name', 'display_name'];
  const managementScope = data?.management_scope || {};
  const scopeAssets = safeArray(managementScope.assets);
  const scopeFunds = safeArray(managementScope.funds);
  const scopeLinks = safeArray(managementScope.readableLinks).length
    ? safeArray(managementScope.readableLinks)
    : safeArray(managementScope.links);
  const normalizeManagementKey = (value) => text(value, '').replace(/\s+/gu, '').toLowerCase();
  const optionRefs = (row, keys) => keys.map((key) => text(row?.[key], '')).filter(Boolean);
  const makeScopeOptions = (rows, keys, labelKeys) => {
    const seen = new Set();
    return rows.map((row) => {
      const label = text(firstText(...labelKeys.map((key) => row?.[key])), '');
      if (!label || seen.has(label)) return null;
      seen.add(label);
      return { label, refs: optionRefs(row, keys).map(normalizeManagementKey).filter(Boolean) };
    }).filter(Boolean);
  };
  const scopeAssetOptions = makeScopeOptions(scopeAssets, ['asset_id', 'asset_code', 'asset_name'], ['asset_name', 'asset_code', 'asset_id']);
  const scopeFundOptions = makeScopeOptions(scopeFunds, ['fund_id', 'fund_code', 'fund_name', 'short_name', 'display_name'], ['display_name', 'short_name', 'fund_name', 'fund_code', 'fund_id']);
  const scopeRefs = [
    ...scopeAssetOptions.flatMap((option) => option.refs),
    ...scopeFundOptions.flatMap((option) => option.refs),
  ].filter(Boolean);
  const rowManagementHaystack = (row) => normalizeManagementKey([
    row?.natural_key,
    row?.sheet_name,
    JSON.stringify(row?.row_values || {}),
    JSON.stringify(row?.normalized_values || {}),
  ].join(' '));
  const rowMatchesRefs = (row, refs) => {
    if (!refs.length) return true;
    const haystack = rowManagementHaystack(row);
    return refs.some((ref) => ref && haystack.includes(ref));
  };
  const isMarketWorkbench = domainForTab === 'sector_market';
  const scopedDomainRows = isMarketWorkbench
    ? domainRows
    : (scopeRefs.length ? domainRows.filter((row) => rowMatchesRefs(row, scopeRefs)) : domainRows);
  const rowSearchText = (row) => [
    text(row.sheet_name, ''),
    rowOptionValue(row, assetKeys),
    rowOptionValue(row, fundKeys),
    sourceRowDisplayTitle(row),
    sourceRowDisplaySummary(row),
  ].join(' ').toLowerCase();
  const managementAssetOptions = [MANAGEMENT_ALL_OPTION, ...scopeAssetOptions.map((option) => option.label).sort((a, b) => a.localeCompare(b, 'ko'))];
  const selectedAssetRefs = managementAsset === MANAGEMENT_ALL_OPTION
    ? []
    : (scopeAssetOptions.find((option) => option.label === managementAsset)?.refs || [normalizeManagementKey(managementAsset)]);
  const linkMatchesSelectedAsset = (link) => {
    if (!selectedAssetRefs.length) return true;
    const linkRefs = optionRefs(link, ['asset_id', 'asset_code', 'asset_name']).map(normalizeManagementKey).filter(Boolean);
    return linkRefs.some((ref) => selectedAssetRefs.includes(ref));
  };
  const linkedFundRefs = [...new Set(scopeLinks
    .filter(linkMatchesSelectedAsset)
    .flatMap((link) => optionRefs(link, ['fund_id', 'fund_code', 'fund_name', 'short_name', 'display_name'])))]
    .map(normalizeManagementKey)
    .filter(Boolean);
  const linkedScopeFundOptions = selectedAssetRefs.length && linkedFundRefs.length
    ? scopeFundOptions.filter((option) => option.refs.some((ref) => linkedFundRefs.includes(ref)))
    : scopeFundOptions;
  const managementFundOptions = [MANAGEMENT_ALL_OPTION, ...linkedScopeFundOptions.map((option) => option.label).sort((a, b) => a.localeCompare(b, 'ko'))];
  const selectedFundRefs = managementFund === MANAGEMENT_ALL_OPTION
    ? []
    : (scopeFundOptions.find((option) => option.label === managementFund)?.refs || [normalizeManagementKey(managementFund)]);
  const isFundLockedByAsset = Boolean(selectedAssetRefs.length && linkedScopeFundOptions.length <= 1);
  const linkedFundDisplay = selectedAssetRefs.length
    ? (linkedScopeFundOptions.map((option) => option.label).join(', ') || '연결 펀드 없음')
    : '전체 펀드';
  const appliesEntityFilter = !isMarketWorkbench;
  const filteredRows = scopedDomainRows
    .filter((row) => !appliesEntityFilter || rowMatchesRefs(row, selectedAssetRefs))
    .filter((row) => !appliesEntityFilter || rowMatchesRefs(row, selectedFundRefs))
    .filter((row) => !managementSearch || rowSearchText(row).includes(managementSearch.toLowerCase()));
  const accessScope = text(data?.access_scope, 'unknown');
  const managedAssetCodes = safeArray(data?.managed_asset_codes);
  const scopeAssetCount = Number(managementScope.asset_count || scopeAssets.length || 0);
  const scopeFundCount = Number(managementScope.fund_count || scopeFunds.length || 0);
  const scopeReadableAssetCount = Number(managementScope.readable_asset_count || scopeAssets.length || 0);
  const scopeReadableFundCount = Number(managementScope.readable_fund_count || scopeFunds.length || 0);
  const scopeLabel = accessScope === 'manager_full_source'
    ? `이지스자산운용 관리 범위: 자산 ${formatNumber(scopeAssetCount)}개 / 펀드 ${formatNumber(scopeFundCount)}개`
    : `이지스자산운용 관리 범위 중 내 권한: 자산 ${formatNumber(scopeReadableAssetCount)}개 / 펀드 ${formatNumber(scopeReadableFundCount)}개`;
  const rowAccessMessage = !sourceRows.length
    ? (accessScope === 'manager_full_source'
      ? '아직 조회 가능한 수정 대상 데이터가 없습니다. Source Update의 active 상태 또는 관리 권한을 확인해 주세요.'
      : `현재 계정은 담당 자산 범위만 조회할 수 있습니다.${managedAssetCodes.length ? ` 담당 자산: ${managedAssetCodes.join(', ')}` : ' 담당 자산이 배정되지 않았습니다.'}`)
    : (!filteredRows.length ? '선택한 이지스자산운용 관리 범위에 해당하는 수정 대상 데이터가 없습니다. 다른 업무 탭이나 자산/펀드 필터를 확인해 주세요.' : '');
  const fallbackGridRows = !filteredRows.length
    ? (scopedDomainRows.length ? scopedDomainRows.slice(0, 12) : sourceRows.slice(0, 12))
    : [];
  const managementGridRows = filteredRows.length ? filteredRows.slice(0, 60) : fallbackGridRows;
  const gridUsesFallback = !filteredRows.length;
  const selectedRow = managementGridRows.find((row) => row.source_row_id === selectedRowId) || managementGridRows[0] || null;
  const rowValues = selectedRow?.row_values && typeof selectedRow.row_values === 'object' ? selectedRow.row_values : {};
  const editableFields = Object.keys(rowValues).filter(isUserVisibleField).slice(0, 80);
  const selectedEditRequest = edits.find((row) => (row.request_id || row.id) === selectedEditRequestId) || null;
  const managementGridFields = useMemo(() => {
    const fieldCounts = new Map();
    managementGridRows.slice(0, 200).forEach((row) => {
      const values = row?.row_values && typeof row.row_values === 'object' ? row.row_values : {};
      Object.keys(values).filter(isUserVisibleField).forEach((field) => {
        fieldCounts.set(field, (fieldCounts.get(field) || 0) + 1);
      });
    });
    const priorityPattern = /자산|센터|펀드|임차|계약|면적|임대|관리|보증|주소|규모|gfa|dock|층고|pm|fm|보험|utility|tranche|금리|만기/iu;
    return [...fieldCounts.entries()]
      .sort((a, b) => {
        const priorityDiff = Number(priorityPattern.test(b[0])) - Number(priorityPattern.test(a[0]));
        if (priorityDiff) return priorityDiff;
        return b[1] - a[1] || fieldDisplayLabel(a[0]).localeCompare(fieldDisplayLabel(b[0]), 'ko');
      })
      .map(([field]) => field)
      .slice(0, 10);
  }, [managementGridRows]);
  const gridCellKey = (rowId, field) => `${rowId}::${field}`;
  const gridCellBeforeValue = (row, field) => text((row?.row_values && typeof row.row_values === 'object' ? row.row_values : {})[field], '');
  const managementDraftEntries = useMemo(() => Object.entries(gridDrafts).map(([key, requestedValue]) => {
    const splitIndex = key.indexOf('::');
    const sourceRowId = splitIndex === -1 ? '' : key.slice(0, splitIndex);
    const field = splitIndex === -1 ? '' : key.slice(splitIndex + 2);
    const row = filteredRows.find((item) => item.source_row_id === sourceRowId);
    if (!row || !field) return null;
    const beforeValue = gridCellBeforeValue(row, field);
    if (text(requestedValue, '') === beforeValue) return null;
    const source = sources.find((item) => item.source_file_id === row.source_file_id) || {};
    return {
      key,
      row,
      source,
      field,
      beforeValue,
      requestedValue: text(requestedValue, ''),
      title: sourceRowDisplayTitle(row),
    };
  }).filter(Boolean), [gridDrafts, filteredRows, sources]);
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
    setGridDrafts({});
    setGridReason('');
    setSubmitStatus(null);
    setPreview(null);
    setSelectedEditRequestId('');
  }, [tab]);
  useEffect(() => {
    if (!managementFundOptions.includes(managementFund)) {
      setManagementFund(managementFundOptions[1] || MANAGEMENT_ALL_OPTION);
      return;
    }
    if (selectedAssetRefs.length && linkedScopeFundOptions.length === 1 && managementFund !== linkedScopeFundOptions[0].label) {
      setManagementFund(linkedScopeFundOptions[0].label);
    }
  }, [managementAsset, managementFund, managementFundOptions.join('|'), linkedScopeFundOptions.map((option) => option.label).join('|'), selectedAssetRefs.join('|')]);
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
        target_name: sourceRowDisplayTitle(selectedRow),
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
        impact_summary: '수정 대상 데이터 변경 요청입니다. 승인 후 정규 테이블 반영 여부를 검토해야 합니다.',
      });
      setSubmitStatus({ type: 'success', message: '승인 요청이 저장되었습니다. 승인 대기 탭에서 처리 상태를 확인해 주세요.' });
      reload({}, { force: true });
    } catch (submitError) {
      setSubmitStatus({ type: 'error', message: submitError.message || '승인 요청 저장에 실패했습니다.' });
    }
  };
  const setGridCellDraft = (row, field, value) => {
    const key = gridCellKey(row.source_row_id, field);
    const beforeValue = gridCellBeforeValue(row, field);
    setSelectedRowId(row.source_row_id);
    setSelectedField(field);
    setAfterValue(value);
    setGridDrafts((current) => {
      const next = { ...current };
      if (text(value, '') === beforeValue) delete next[key];
      else next[key] = value;
      return next;
    });
  };
  const submitDraftEdits = async () => {
    if (!managementDraftEntries.length) {
      setSubmitStatus({ type: 'error', message: '승인 요청할 변경 셀이 없습니다.' });
      return;
    }
    setSubmitStatus({ type: 'pending', message: `변경 ${formatNumber(managementDraftEntries.length)}건을 검증하고 승인 요청하는 중입니다.` });
    try {
      for (const entry of managementDraftEntries) {
        const previewResult = await invoke('data-management/preview-edit', {
          source_row_id: entry.row.source_row_id,
          field_name: entry.field,
          before_value: entry.beforeValue,
          requested_value: entry.requestedValue,
          source_domain: entry.source.source_domain,
          sheet_name: entry.row.sheet_name,
          row_number: entry.row.row_number,
        });
        const errors = safeArray(previewResult?.validations).filter((item) => item.level === 'error');
        if (errors.length) throw new Error(`${entry.title} · ${fieldDisplayLabel(entry.field)}: ${errors[0].message}`);
        await invoke('data-management/submit-edit', {
          source_table: 'public.ll_source_rows',
          source_domain: entry.source.source_domain,
          target_type: `${entry.source.source_domain || 'source'}_edit`,
          target_name: sourceRowDisplayTitle(entry.row),
          target_row_id: entry.row.source_row_id,
          field_name: entry.field,
          before_value: entry.beforeValue,
          requested_value: entry.requestedValue,
          target_table: previewResult?.target?.target_table,
          target_field: previewResult?.target?.target_field,
          target_record_id: previewResult?.target?.target_row_id,
          primary_key_field: previewResult?.target?.primary_key_field,
          reason: gridReason || reason || 'Data Management 그리드 수정',
          sheet_name: entry.row.sheet_name,
          row_number: entry.row.row_number,
          impact_summary: 'Data Management 그리드에서 수정한 변경 요청입니다.',
        });
      }
      setGridDrafts({});
      setGridReason('');
      setSubmitStatus({ type: 'success', message: `변경 ${formatNumber(managementDraftEntries.length)}건의 승인 요청이 저장되었습니다.` });
      reload({}, { force: true });
    } catch (submitError) {
      setSubmitStatus({ type: 'error', message: submitError.message || '그리드 변경 승인 요청 저장에 실패했습니다.' });
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
      reload({}, { force: true });
    } catch (reviewError) {
      setSubmitStatus({ type: 'error', message: reviewError.message || '요청 처리에 실패했습니다.' });
    }
  };
  const workbenchAreas = [
    { id: 'my', label: '이지스 전체', domain: '', group: 'igis', detail: '이지스자산운용 19개 자산과 17개 펀드의 대시보드 관리 데이터를 한 번에 확인합니다.' },
    { id: 'lease', label: '임대차', domain: 'lease_contracts', group: 'igis', detail: '임차인, 계약기간, 면적, 임대료, 관리비, 공실 값을 관리합니다.' },
    { id: 'fund', label: '펀드/금융', domain: 'fund_info', group: 'igis', detail: '펀드, 수익자, 대주, 트랜치, 금리, 만기 값을 관리합니다.' },
    { id: 'spec', label: '자산 스펙', domain: 'asset_specs', group: 'igis', detail: '주소, 규모, Dock, 층고, 상저온, 설비 값을 관리합니다.' },
    { id: 'cost', label: '운영비용', domain: 'operating_costs', group: 'igis', detail: 'PM/FM, 보험료, Utility와 기간별 비용 값을 관리합니다.' },
    { id: 'permission', label: '권한/사용자', domain: 'permissions', group: 'igis', detail: '사용자, 담당 자산, 기능 권한, 계정 상태를 관리합니다.' },
    { id: 'market', label: '시장 Data', domain: 'sector_market', group: 'market', detail: '물류 시장 원천의 임대시장, 공급, 거래, Cap Rate 데이터를 자산/펀드 선택 없이 관리합니다.' },
    { id: 'approval', label: '승인 대기', domain: '', group: 'ops', detail: '요청된 변경을 승인하거나 반려하고 readback 결과를 확인합니다.' },
    { id: 'history', label: '반영 이력', domain: '', group: 'ops', detail: '승인/반영 결과와 readback 상태를 시간순으로 확인합니다.' },
  ];
  const igisWorkbenchAreas = workbenchAreas.filter((area) => area.group === 'igis');
  const marketWorkbenchAreas = workbenchAreas.filter((area) => area.group === 'market');
  const systemWorkbenchAreas = workbenchAreas.filter((area) => area.group === 'ops');
  const activeWorkbenchArea = workbenchAreas.find((area) => area.id === tab) || workbenchAreas[0];
  const activeSpaceLabel = activeWorkbenchArea.group === 'market'
    ? '시장 Data'
    : activeWorkbenchArea.group === 'ops'
      ? '시스템·운영 Data'
      : '이지스 Data';
  const sourceDomainForRow = (row) => sources.find((source) => source.source_file_id === row.source_file_id)?.source_domain || '';
  const countRowsForArea = (area) => {
    if (area.id === 'my') {
      return sourceRows.filter((row) => {
        const domain = sourceDomainForRow(row);
        return DATA_MANAGEMENT_DOMAIN_KEYS.has(domain) && domain !== 'sector_market';
      }).length;
    }
    if (area.group === 'ops') {
      return edits.length;
    }
    return sourceRows.filter((row) => sourceDomainForRow(row) === area.domain).length;
  };
  const activeWorkbenchMode = activeWorkbenchArea.group === 'ops' ? 'system' : 'grid';
  const pendingEditRows = edits.filter((row) => row.status === 'submitted' || row.write_status === 'approval_required');
  const historyEditRows = edits.filter((row) => !(row.status === 'submitted' || row.write_status === 'approval_required'));
  const workbenchApprovalColumns = [
    { key: 'target_name', label: '대상', render: (value, row) => text(value || row.target_type, '-') },
    { key: 'source_domain', label: '영역', render: (value) => sourceDomainLabel(value) },
    { key: 'field_name', label: '필드', render: (value) => fieldDisplayLabel(value) },
    { key: 'before_value', label: 'Before', render: (value, row) => formatDisplayValue(value, row.field_name) },
    { key: 'requested_value', label: 'After', render: (value, row) => formatDisplayValue(value, row.field_name) },
    { key: 'status', label: '상태', render: (value, row) => text(row.write_status || value, '-') },
    { key: 'created_at', label: '요청일', render: formatDateTime },
    {
      key: 'review_action',
      label: '처리',
      align: 'right',
      render: (_, row) => data?.can_approve ? (
        <div className="flex justify-end gap-2">
          <button type="button" disabled={row.requested_by === data?.user_id} onClick={(event) => { event.stopPropagation(); reviewEdit('approve', row); }} className="h-7 rounded-[7px] border border-white bg-white px-2 text-[11px] font-bold text-[#1F1F1E] disabled:opacity-35">승인</button>
          <button type="button" onClick={(event) => { event.stopPropagation(); reviewEdit('reject', row); }} className="h-7 rounded-[7px] border border-[#3A3A3C] px-2 text-[11px] font-semibold text-[#A1A1AA]">반려</button>
        </div>
      ) : <span className="text-[11px] text-[#86868B]">권한 없음</span>,
    },
  ];
  const workbenchHistoryColumns = [
    { key: 'target_name', label: '대상', render: (value, row) => text(value || row.target_type, '-') },
    { key: 'source_domain', label: '영역', render: (value) => sourceDomainLabel(value) },
    { key: 'field_name', label: '필드', render: (value) => fieldDisplayLabel(value) },
    { key: 'requested_value', label: '요청값', render: (value, row) => formatDisplayValue(value, row.field_name) },
    { key: 'readback_value', label: 'Readback', render: (value, row) => formatDisplayValue(value, row.field_name) },
    { key: 'status', label: '상태', render: (value, row) => text(row.write_status || value, '-') },
    { key: 'updated_at', label: '최종 변경', render: formatDateTime },
  ];
  const setInspectorAfterValue = (value) => {
    setAfterValue(value);
    if (selectedRow && selectedField) setGridCellDraft(selectedRow, selectedField, value);
  };
  const workbenchRowMessage = !sourceRows.length
    ? '관리 가능한 데이터가 아직 로드되지 않았습니다. 데이터 다시 읽기를 눌러 주세요.'
    : (gridUsesFallback
      ? '선택한 조건에 맞는 데이터가 없어 대표 행을 읽기 전용으로 보여드립니다. 자산-펀드 묶음 또는 검색 조건을 조정해 주세요.'
      : '');
  const workbenchScopeAssetCount = Number(managementScope.asset_count || scopeAssets.length || 0);
  const workbenchScopeFundCount = Number(managementScope.fund_count || scopeFunds.length || 0);
  return (
    <div className="w-full max-w-[1680px] mx-auto px-8 pt-8 pb-14">
      <ModuleHeader
        eyebrow="DATA MANAGEMENT"
        title="데이터 관리"
        right={<button type="button" onClick={() => reload({}, { force: true })} className="h-9 rounded-[8px] border border-[#3A3A3C] px-3 text-[13px] font-semibold text-white hover:bg-white/5">데이터 다시 읽기</button>}
      />

      <section className={`${CARD} mb-5 p-4`} data-data-management-initial-selector="true">
        <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,1fr)_460px]">
          <div className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#86868B]">현재 공간</div>
                <div className="mt-1 text-[18px] font-bold text-white">{activeSpaceLabel}</div>
                <div className="mt-1 text-[12px] text-[#A1A1AA]">{activeWorkbenchArea.detail}</div>
              </div>
              <div className="rounded-[10px] border border-[#3A3A3C] bg-[#171717] px-3 py-2 text-[12px] text-[#D1D1D6]">
                {activeWorkbenchArea.group === 'ops'
                  ? '시스템·운영 Data는 승인 대기와 반영 이력을 함께 보여줍니다.'
                  : isMarketWorkbench
                    ? '시장 Data는 자산/펀드 선택 없이 전용 필터로만 탐색합니다.'
                    : '이지스 Data는 자산-펀드 묶음으로만 범위를 좁힙니다.'}
              </div>
            </div>
            {isMarketWorkbench ? (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                <div className="rounded-[10px] border border-[#3A3A3C] bg-[#171717] px-3 py-2">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#86868B]">시장 Data 범위</div>
                  <div className="mt-1 text-[12px] font-semibold text-white">자산/펀드 선택 없이 물류 시장 원천 데이터를 관리합니다.</div>
                </div>
                <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#86868B]">
                  통합 검색
                  <input value={managementSearch} onChange={(event) => setManagementSearch(event.target.value)} className="mt-2 h-10 w-full rounded-[8px] border border-[#3A3A3C] bg-[#171717] px-3 text-[12px] text-white outline-none" placeholder="시트명, 원천값, 주소 검색" />
                </label>
              </div>
            ) : activeWorkbenchArea.group === 'ops' ? (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                <div className="rounded-[10px] border border-[#3A3A3C] bg-[#171717] px-3 py-2">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#86868B]">시스템·운영 범위</div>
                  <div className="mt-1 text-[12px] font-semibold text-white">승인 대기와 반영 이력을 한 화면에서 검토합니다.</div>
                </div>
                <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#86868B]">
                  통합 검색
                  <input value={managementSearch} onChange={(event) => setManagementSearch(event.target.value)} className="mt-2 h-10 w-full rounded-[8px] border border-[#3A3A3C] bg-[#171717] px-3 text-[12px] text-white outline-none" placeholder="대상, 필드, 요청자 검색" />
                </label>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.9fr)]">
                <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#86868B]">
                  자산-펀드 묶음 · 자산
                  <select value={managementAsset} onChange={(event) => setManagementAsset(event.target.value)} className="mt-2 h-10 w-full rounded-[8px] border border-[#3A3A3C] bg-[#171717] px-3 text-[12px] text-white outline-none">
                    {managementAssetOptions.map((option) => <option key={option} value={option}>{option === MANAGEMENT_ALL_OPTION ? '전체 자산' : option}</option>)}
                  </select>
                </label>
                <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#86868B]">
                  자산-펀드 묶음 · 연결 펀드
                  <select value={managementFund} onChange={(event) => setManagementFund(event.target.value)} disabled={isFundLockedByAsset} className="mt-2 h-10 w-full rounded-[8px] border border-[#3A3A3C] bg-[#171717] px-3 text-[12px] text-white outline-none disabled:cursor-not-allowed disabled:opacity-70">
                    {managementFundOptions.map((option) => <option key={option} value={option}>{option === MANAGEMENT_ALL_OPTION ? '전체 펀드' : option}</option>)}
                  </select>
                  <span className="mt-1 block truncate text-[11px] normal-case tracking-normal text-[#86868B]">{managementAsset === MANAGEMENT_ALL_OPTION ? '자산을 선택하면 연결 펀드가 자동으로 좁혀집니다.' : linkedFundDisplay}</span>
                </label>
                <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#86868B]">
                  통합 검색
                  <input value={managementSearch} onChange={(event) => setManagementSearch(event.target.value)} className="mt-2 h-10 w-full rounded-[8px] border border-[#3A3A3C] bg-[#171717] px-3 text-[12px] text-white outline-none" placeholder="자산, 펀드, 임차인, 시트명" />
                </label>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4" data-data-management-selector-count="true">
            <MetricCard label="관리 자산" value={formatNumber(workbenchScopeAssetCount)} detail="이지스자산운용" />
            <MetricCard label="관리 펀드" value={formatNumber(workbenchScopeFundCount)} detail="이지스자산운용" />
            <MetricCard label="표시 행" value={formatNumber(filteredRows.length)} detail="현재 조건" />
            <MetricCard label="승인 대기" value={formatNumber(pendingEditRows.length)} detail="검토 필요" />
          </div>
        </div>
        <div className="mt-3 text-[12px] text-[#A1A1AA]" data-data-management-igis-scope="true">
          이지스자산운용 관리 범위: 자산 {formatNumber(workbenchScopeAssetCount)}개 / 펀드 {formatNumber(workbenchScopeFundCount)}개
        </div>
      </section>

      {error ? <div className="mb-5 rounded-[10px] border border-[#5A4420] bg-[#2A2115] px-4 py-3 text-[12px] text-[#FFD479]">{error}</div> : null}
      {loading && !data ? <div className={`${CARD} mb-5 p-5 text-[13px] text-[#A1A1AA]`}>데이터 관리 워크벤치를 불러오는 중입니다.</div> : null}

      <div className="grid grid-cols-1 gap-5 2xl:grid-cols-[270px_minmax(0,1fr)_360px]">
        <aside className={`${CARD} p-4`}>
          <div className="mb-3 text-[13px] font-bold text-white">ll_ 전체 업무 데이터</div>
          <div className="space-y-2">
            {[
              ['이지스 Data', igisWorkbenchAreas],
              ['시장 Data', marketWorkbenchAreas],
              ['시스템·운영 Data', systemWorkbenchAreas],
            ].map(([groupLabel, areas]) => (
              <div key={groupLabel} className="space-y-2">
                <div className="px-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#86868B]">{groupLabel}</div>
                {areas.map((area) => {
                  const stats = domainStats.find((row) => row.source_domain === area.domain) || {};
                  const active = tab === area.id;
                  return (
                    <button
                      key={area.id}
                      type="button"
                      onClick={() => setTab(area.id)}
                      className={`${active ? 'border-white bg-white text-[#1F1F1E]' : 'border-[#3A3A3C] bg-[#1F1F1E] text-[#D1D1D6] hover:border-[#5A5A5C]'} w-full rounded-[10px] border px-3 py-3 text-left transition`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[12px] font-bold">{area.label}</span>
                        <span className="text-[11px] opacity-70">{formatNumber(countRowsForArea(area) || stats.total_rows || 0)}</span>
                      </div>
                      <div className="mt-1 line-clamp-2 text-[11px] leading-4 opacity-70">{area.detail}</div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setTab('approval')} className={`${tab === 'approval' ? 'border-white bg-white text-[#1F1F1E]' : 'border-[#3A3A3C] text-[#D1D1D6]'} h-9 rounded-[8px] border text-[12px] font-semibold`}>승인 대기</button>
            <button type="button" onClick={() => setTab('history')} className={`${tab === 'history' ? 'border-white bg-white text-[#1F1F1E]' : 'border-[#3A3A3C] text-[#D1D1D6]'} h-9 rounded-[8px] border text-[12px] font-semibold`}>반영 이력</button>
          </div>
        </aside>

        <section className={`${CARD} min-w-0 p-4`}>
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[18px] font-bold text-white">{activeWorkbenchMode === 'system' ? '시스템·운영 Data' : activeWorkbenchArea.label}</div>
              <div className="mt-1 text-[12px] text-[#A1A1AA]">{activeWorkbenchMode === 'grid' ? activeWorkbenchArea.detail : '승인 요청과 실제 반영 결과를 한 화면에서 확인합니다.'}</div>
            </div>
            <div className="flex gap-2 text-[11px] text-[#86868B]">
              <span>{accessScope === 'manager_full_source' ? '전체 관리 권한' : '담당 자산 권한'}</span>
              <span>·</span>
              <span>{formatNumber(filteredRows.length)}행</span>
            </div>
          </div>

          {activeWorkbenchMode === 'system' ? (
            <div className="space-y-4">
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="text-[12px] font-semibold text-white">승인 대기</div>
                  <div className="text-[11px] text-[#86868B]">{formatNumber(pendingEditRows.length)}건</div>
                </div>
                <SortableTable
                  minWidth={1040}
                  maxHeight={320}
                  stickyCount={1}
                  defaultSort={{ key: 'created_at', direction: 'desc' }}
                  columns={workbenchApprovalColumns}
                  rows={pendingEditRows}
                  onRowClick={(row) => setSelectedEditRequestId(row.request_id || row.id || '')}
                />
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="text-[12px] font-semibold text-white">반영 이력</div>
                  <div className="text-[11px] text-[#86868B]">{formatNumber(historyEditRows.length)}건</div>
                </div>
                <SortableTable
                  minWidth={1040}
                  maxHeight={260}
                  stickyCount={1}
                  defaultSort={{ key: 'updated_at', direction: 'desc' }}
                  columns={workbenchHistoryColumns}
                  rows={historyEditRows.length ? historyEditRows : edits}
                  onRowClick={(row) => setSelectedEditRequestId(row.request_id || row.id || '')}
                />
              </div>
            </div>
          ) : (
            <div>
              {workbenchRowMessage ? <div className="mb-3 rounded-[10px] border border-[#3A3A3C] bg-[#1F1F1E] px-4 py-3 text-[12px] text-[#A1A1AA]">{workbenchRowMessage}</div> : null}
              {managementGridRows.length ? (
                <div className="custom-scrollbar max-h-[640px] overflow-auto rounded-[10px] border border-[#333333]" data-sortable-table="true" data-data-management-edit-grid="true">
                  <table className="w-full min-w-[1120px] border-collapse text-left text-[12px]">
                    <thead className="sticky top-0 z-20 bg-[#1F1F1E] text-[11px] uppercase tracking-[0.04em] text-[#A1A1AA]">
                      <tr>
                        <th className="sticky left-0 z-30 w-[220px] border-b border-[#333333] bg-[#1F1F1E] px-3 py-3">수정 대상</th>
                        <th className="w-[130px] border-b border-[#333333] px-3 py-3">영역</th>
                        {managementGridFields.map((field) => <th key={field} className="min-w-[150px] border-b border-[#333333] px-3 py-3">{fieldDisplayLabel(field)}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {managementGridRows.map((row) => {
                        const domain = sources.find((source) => source.source_file_id === row.source_file_id)?.source_domain;
                        return (
                          <tr key={row.source_row_id} className={`${selectedRow?.source_row_id === row.source_row_id ? 'bg-[#242B32]' : 'bg-[#171717]'} border-b border-[#2A2A29] hover:bg-[#222222]`}>
                            <td className="sticky left-0 z-10 max-w-[220px] bg-inherit px-3 py-3 align-top">
                              <button type="button" onClick={() => setSelectedRowId(row.source_row_id)} className="block w-full text-left">
                                <div className="truncate font-bold text-white">{sourceRowDisplayTitle(row)}</div>
                                <div className="mt-1 truncate text-[11px] text-[#86868B]">{sourceRowDisplaySummary(row)}</div>
                              </button>
                            </td>
                            <td className="px-3 py-3 align-top text-[#D1D1D6]">{sourceDomainLabel(domain)}</td>
                            {managementGridFields.map((field) => {
                              const beforeValue = gridCellBeforeValue(row, field);
                              const key = gridCellKey(row.source_row_id, field);
                              const draftValue = Object.prototype.hasOwnProperty.call(gridDrafts, key) ? gridDrafts[key] : beforeValue;
                              const changed = text(draftValue, '') !== beforeValue;
                              return (
                                <td key={field} className="min-w-[150px] px-2 py-2 align-top">
                                  <textarea
                                    value={text(draftValue, '')}
                                    readOnly={gridUsesFallback}
                                    onFocus={() => {
                                      if (gridUsesFallback) return;
                                      setSelectedRowId(row.source_row_id);
                                      setSelectedField(field);
                                      setAfterValue(text(draftValue, ''));
                                    }}
                                    onChange={(event) => {
                                      if (gridUsesFallback) return;
                                      setGridCellDraft(row, field, event.target.value);
                                    }}
                                    rows={2}
                                    className={`${gridUsesFallback ? 'cursor-not-allowed border-[#2E2E2E] bg-[#141414] text-[#8A8A8A]' : changed ? 'border-[#9AD7FF] bg-[#182535]' : 'border-transparent bg-transparent'} h-[54px] w-full resize-none rounded-[7px] border px-2 py-1 text-[12px] text-white outline-none focus:border-[#9AD7FF] focus:bg-[#1F1F1E]`}
                                  />
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          )}
        </section>

        <aside className={`${CARD} p-4`}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="text-[13px] font-bold text-white">{activeWorkbenchMode === 'system' ? '승인·이력 검토' : '검증 및 승인 요청'}</div>
            <span className="rounded-full border border-[#3A3A3C] px-2 py-1 text-[10px] text-[#A1A1AA]">{activeWorkbenchMode === 'system' ? formatNumber(pendingEditRows.length + historyEditRows.length) + '개 요청' : formatNumber(managementDraftEntries.length) + '개 변경'}</span>
          </div>
          <div className="space-y-4">
            {activeWorkbenchMode === 'system' ? (
              <>
                <div className={`${INNER} p-3`}>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#86868B]">선택된 요청</div>
                  <div className="mt-2 text-[13px] font-bold text-white">{selectedEditRequest ? text(selectedEditRequest.target_name || selectedEditRequest.target_type, '요청을 선택해 주세요') : '요청을 선택해 주세요'}</div>
                  <div className="mt-1 text-[11px] text-[#A1A1AA]">
                    {selectedEditRequest
                      ? `${sourceDomainLabel(selectedEditRequest.source_domain)} · ${fieldDisplayLabel(selectedEditRequest.field_name)} · ${text(selectedEditRequest.write_status || selectedEditRequest.status, '-')}`
                      : '행을 클릭하면 요청 상세와 처리 버튼이 표시됩니다.'}
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <label className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#86868B]">
                    Before
                    <textarea readOnly value={selectedEditRequest ? formatDisplayValue(selectedEditRequest.before_value, selectedEditRequest.field_name) : '-'} rows={3} className="mt-2 w-full resize-none rounded-[8px] border border-[#3A3A3C] bg-[#111111] px-3 py-2 text-[12px] text-[#A1A1AA] outline-none" />
                  </label>
                  <label className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#86868B]">
                    After
                    <textarea readOnly value={selectedEditRequest ? formatDisplayValue(selectedEditRequest.requested_value, selectedEditRequest.field_name) : '-'} rows={3} className="mt-2 w-full resize-none rounded-[8px] border border-[#3A3A3C] bg-[#111111] px-3 py-2 text-[12px] text-[#A1A1AA] outline-none" />
                  </label>
                  <label className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#86868B]">
                    Readback
                    <textarea readOnly value={selectedEditRequest ? formatDisplayValue(selectedEditRequest.readback_value, selectedEditRequest.field_name) : '-'} rows={3} className="mt-2 w-full resize-none rounded-[8px] border border-[#3A3A3C] bg-[#111111] px-3 py-2 text-[12px] text-[#A1A1AA] outline-none" />
                  </label>
                </div>
                <div className={`${INNER} p-3`}>
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#86868B]">처리</div>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => selectedEditRequest && reviewEdit('readback', selectedEditRequest)} disabled={!selectedEditRequest} className="h-9 rounded-[8px] border border-[#3A3A3C] text-[12px] font-semibold text-[#D1D1D6] disabled:opacity-40">Readback 재확인</button>
                    <button type="button" onClick={() => selectedEditRequest && reviewEdit('approve', selectedEditRequest)} disabled={!selectedEditRequest || !data?.can_approve} className="h-9 rounded-[8px] bg-white text-[12px] font-bold text-[#1F1F1E] disabled:opacity-40">승인</button>
                    <button type="button" onClick={() => selectedEditRequest && reviewEdit('reject', selectedEditRequest)} disabled={!selectedEditRequest || !data?.can_approve} className="h-9 rounded-[8px] border border-[#5A2A2A] text-[12px] font-semibold text-[#FFB4B4] disabled:opacity-40">반려</button>
                    <button type="button" onClick={() => setSelectedEditRequestId('')} className="h-9 rounded-[8px] border border-[#3A3A3C] text-[12px] font-semibold text-[#D1D1D6]">선택 해제</button>
                  </div>
                </div>
                <div className={`${INNER} p-3`}>
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#86868B]">상태 요약</div>
                  <div className="text-[12px] text-[#A1A1AA]">
                    {selectedEditRequest
                      ? `요청자 ${text(selectedEditRequest.requested_by, '-')} · 생성 ${formatDateTime(selectedEditRequest.created_at)} · 최종 ${formatDateTime(selectedEditRequest.updated_at)}`
                      : '승인 대기 또는 이력 항목을 클릭해 주세요.'}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className={`${INNER} p-3`}>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#86868B]">수정 대상</div>
                  <div className="mt-2 text-[13px] font-bold text-white">{selectedRow ? sourceRowDisplayTitle(selectedRow) : '행을 선택해 주세요'}</div>
                  <div className="mt-1 text-[11px] text-[#A1A1AA]">{selectedRow ? sourceDomainLabel(selectedSource.source_domain) + ' · ' + text(selectedRow.sheet_name, '-') : '-'}</div>
                </div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#86868B]">
                  수정 필드
                  <select value={selectedField} onChange={(event) => setSelectedField(event.target.value)} className="mt-2 h-10 w-full rounded-[8px] border border-[#3A3A3C] bg-[#171717] px-3 text-[12px] text-white outline-none">
                    {editableFields.map((field) => <option key={field} value={field}>{fieldDisplayLabel(field)}</option>)}
                  </select>
                </label>
                <div className="grid grid-cols-1 gap-3">
                  <label className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#86868B]">
                    Before
                    <textarea readOnly value={currentBeforeDisplayValue} rows={3} className="mt-2 w-full resize-none rounded-[8px] border border-[#3A3A3C] bg-[#111111] px-3 py-2 text-[12px] text-[#A1A1AA] outline-none" />
                  </label>
                  <label className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#86868B]">
                    After
                    <textarea data-data-management-after-value="true" value={afterValue} onChange={(event) => setInspectorAfterValue(event.target.value)} rows={3} className="mt-2 w-full resize-none rounded-[8px] border border-[#3A3A3C] bg-[#171717] px-3 py-2 text-[12px] text-white outline-none focus:border-[#9AD7FF]" />
                  </label>
                </div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#86868B]">
                  변경 사유
                  <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={2} className="mt-2 w-full resize-none rounded-[8px] border border-[#3A3A3C] bg-[#171717] px-3 py-2 text-[12px] text-white outline-none" placeholder="승인자가 이해할 수 있도록 수정 이유를 적어 주세요." />
                </label>
                <div className={`${INNER} p-3`}>
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#86868B]">저장 전 검증</div>
                  {previewLoading ? <div className="text-[12px] text-[#A1A1AA]">검증 중입니다.</div> : null}
                  {!previewLoading && !preview ? <div className="text-[12px] text-[#86868B]">After 값을 바꾸면 권한, 필수값, 단위, 대상 매핑을 확인합니다.</div> : null}
                  {safeArray(preview?.validations).map((item) => (
                    <div key={(item.code || '') + (item.message || '')} className={`${item.level === 'error' ? 'text-[#FF9F9F]' : item.level === 'warning' ? 'text-[#FFD166]' : 'text-[#9AD7FF]'} mt-2 text-[12px] leading-5`}>
                      {item.message || item.code}
                    </div>
                  ))}
                  {preview?.target ? <div className="mt-2 text-[12px] text-[#A1A1AA]">반영 방식: 승인 후 연결된 업무 테이블에 readback 검증</div> : null}
                </div>
                <button type="button" onClick={submitEdit} disabled={!hasPendingChange || previewErrors.length > 0 || previewLoading} className="h-10 w-full rounded-[8px] bg-white text-[13px] font-bold text-[#1F1F1E] disabled:opacity-40">선택 셀 승인 요청</button>
                <div className={`${INNER} p-3`}>
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#86868B]">변경 바구니</div>
                  <div className="max-h-[180px] space-y-2 overflow-y-auto">
                    {managementDraftEntries.length ? managementDraftEntries.slice(0, 12).map((entry) => (
                      <button key={entry.key} type="button" onClick={() => { setSelectedRowId(entry.row.source_row_id); setSelectedField(entry.field); setAfterValue(entry.requestedValue); }} className="block w-full rounded-[8px] border border-[#333333] px-3 py-2 text-left hover:border-[#5A5A5C]">
                        <div className="truncate text-[12px] font-semibold text-white">{entry.title}</div>
                        <div className="truncate text-[11px] text-[#A1A1AA]">{fieldDisplayLabel(entry.field)} · {formatDisplayValue(entry.beforeValue, entry.field)} → {formatDisplayValue(entry.requestedValue, entry.field)}</div>
                      </button>
                    )) : <div className="text-[12px] text-[#86868B]">수정한 셀이 여기에 쌓입니다.</div>}
                  </div>
                  <textarea value={gridReason} onChange={(event) => setGridReason(event.target.value)} rows={2} className="mt-3 w-full resize-none rounded-[8px] border border-[#3A3A3C] bg-[#171717] px-3 py-2 text-[12px] text-white outline-none" placeholder="일괄 요청 사유" />
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setGridDrafts({})} className="h-9 rounded-[8px] border border-[#3A3A3C] text-[12px] font-semibold text-[#D1D1D6]">비우기</button>
                    <button type="button" onClick={submitDraftEdits} disabled={!managementDraftEntries.length} className="h-9 rounded-[8px] bg-[#9AD7FF] text-[12px] font-bold text-[#111111] disabled:opacity-40">일괄 요청</button>
                  </div>
                </div>
              </>
            )}
            {submitStatus ? <div className={`${submitStatus.type === 'error' ? 'border-[#5A2A2A] bg-[#2B1717] text-[#FFB4B4]' : submitStatus.type === 'success' ? 'border-[#2F5A3A] bg-[#172B1D] text-[#B5E48C]' : 'border-[#3A3A3C] bg-[#1F1F1E] text-[#D1D1D6]'} rounded-[10px] border px-3 py-2 text-[12px]`}>{submitStatus.message}</div> : null}
          </div>
        </aside>
      </div>
    </div>
  );
}

export function DataManagementDashboard() {
  const [spaceKey, setSpaceKey] = useState('igis');
  const [viewKey, setViewKey] = useState('lease_contracts');
  const [bundleKey, setBundleKey] = useState(MANAGEMENT_ALL_OPTION);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState({ key: '', direction: 'asc' });
  const [showAllFields, setShowAllFields] = useState(false);
  const [selectedRowKey, setSelectedRowKey] = useState('');
  const [selectedField, setSelectedField] = useState('');
  const [draftValue, setDraftValue] = useState('');
  const [reason, setReason] = useState('');
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null);
  const { loading: viewsLoading, error: viewsError, data: viewCatalog, reload: reloadViews } = useEdgeData('data-management/views', {}, []);
  const spaces = safeArray(viewCatalog?.workspaces);
  const views = safeArray(viewCatalog?.views);
  const bundles = safeArray(viewCatalog?.fund_asset_bundles);
  const scope = viewCatalog?.management_scope || {};
  const viewsForSpace = useMemo(() => views.filter((view) => view.workspace_key === spaceKey), [views, spaceKey]);
  const selectedView = viewsForSpace.find((view) => view.view_key === viewKey) || viewsForSpace[0] || {};
  const effectiveViewKey = text(selectedView.view_key || viewKey || 'lease_contracts');
  const rowsPayload = useMemo(() => ({
    space_key: spaceKey,
    view_key: effectiveViewKey,
    bundle_key: spaceKey === 'igis' && bundleKey !== MANAGEMENT_ALL_OPTION ? bundleKey : '',
    search,
    page,
    page_size: 80,
    sort: sort.key ? [{ key: sort.key, direction: sort.direction }] : [],
  }), [spaceKey, effectiveViewKey, bundleKey, search, page, sort.key, sort.direction]);
  const { loading: rowsLoading, error: rowsError, data: rowsData, reload: reloadRows } = useEdgeData('data-management/view-rows', rowsPayload, [rowsPayload]);
  const columns = safeArray(rowsData?.fields).filter((column) => column && !column.sensitive);
  const visibleColumns = useMemo(() => (
    showAllFields ? columns : columns.filter((column) => column.default_hidden !== true)
  ), [columns, showAllFields]);
  const columnGroups = useMemo(() => {
    const groups = [];
    visibleColumns.forEach((column) => {
      const group = text(column.group, '기본정보');
      const last = groups[groups.length - 1];
      if (last && last.label === group) {
        last.columns.push(column);
      } else {
        groups.push({ label: group, columns: [column] });
      }
    });
    return groups;
  }, [visibleColumns]);
  const rows = safeArray(rowsData?.rows);
  const pagination = rowsData?.pagination || {};
  const selectedRow = rows.find((row) => row.row_key === selectedRowKey) || rows[0] || null;
  const editableColumns = columns.filter((column) => column.editable === true);
  const selectedColumn = columns.find((column) => column.field_key === selectedField || column.field === selectedField)
    || editableColumns[0]
    || columns[0]
    || {};
  const selectedFieldKey = text(selectedColumn.field_key || selectedColumn.field || selectedField);
  const selectedDisplayValues = selectedRow?.display_values && typeof selectedRow.display_values === 'object' ? selectedRow.display_values : {};
  const selectedEditValues = selectedRow?.edit_values && typeof selectedRow.edit_values === 'object' ? selectedRow.edit_values : {};
  const beforeDisplayValue = selectedFieldKey ? text(selectedDisplayValues[selectedFieldKey], '') : '';
  const beforeEditValue = selectedFieldKey ? (selectedEditValues[selectedFieldKey] ?? beforeDisplayValue ?? '') : '';
  const beforeValue = text(beforeEditValue, '');
  const hasChange = Boolean(selectedRow && selectedFieldKey && draftValue !== beforeValue);
  const canEditSelected = Boolean(selectedRow?.row_key && selectedColumn.editable === true && selectedRow.editable !== false);
  const capabilityLabel = (capability) => ({
    approval_required: '승인 후 반영',
    source_review_required: '원천 검토 요청',
    feature_access_workflow: '권한 전용 workflow',
    readback_only: '읽기 전용',
  }[text(capability)] || '읽기 전용');
  const writeModeLabel = capabilityLabel(rowsData?.view?.capability || selectedView.capability);

  useEffect(() => {
    const nextView = viewsForSpace[0]?.view_key || '';
    if (nextView && !viewsForSpace.some((view) => view.view_key === viewKey)) {
      setViewKey(nextView);
      setPage(1);
      setSelectedRowKey('');
    }
  }, [viewsForSpace.map((view) => view.view_key).join('|'), viewKey]);

  useEffect(() => {
    if (selectedRow && selectedRow.row_key !== selectedRowKey) setSelectedRowKey(selectedRow.row_key);
  }, [selectedRow?.row_key, selectedRowKey]);

  useEffect(() => {
    const nextField = editableColumns[0]?.field_key || editableColumns[0]?.field || columns[0]?.field_key || columns[0]?.field || '';
    if (nextField && !columns.some((column) => column.field_key === selectedField || column.field === selectedField)) {
      setSelectedField(nextField);
    }
  }, [columns.map((column) => column.field_key || column.field).join('|'), selectedField]);

  useEffect(() => {
    setDraftValue(beforeValue);
    setPreview(null);
    setSubmitStatus(null);
  }, [selectedRow?.row_key, selectedFieldKey, beforeValue]);

  useEffect(() => {
    let active = true;
    if (!hasChange || !canEditSelected) {
      setPreview(null);
      setPreviewLoading(false);
      return () => { active = false; };
    }
    setPreviewLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const result = await invoke('data-management/preview-edit', {
          edit_mode: 'view_field',
          view_key: effectiveViewKey,
          row_key: selectedRow.row_key,
          field_key: selectedFieldKey,
          requested_value: draftValue,
          revision_hash: selectedRow.revision_hash,
          bundle_key: bundleKey !== MANAGEMENT_ALL_OPTION ? bundleKey : '',
          reason,
        });
        if (active) setPreview(result);
      } catch (previewError) {
        if (active) setPreview({ can_submit: false, validations: [{ level: 'error', message: previewError.message || '저장 전 검증에 실패했습니다.' }] });
      } finally {
        if (active) setPreviewLoading(false);
      }
    }, 350);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [hasChange, canEditSelected, effectiveViewKey, selectedRow?.row_key, selectedRow?.revision_hash, selectedFieldKey, draftValue, bundleKey, reason]);

  const changeSort = (columnKey) => {
    if (!columnKey) return;
    setSort((current) => ({
      key: columnKey,
      direction: current.key === columnKey && current.direction === 'asc' ? 'desc' : 'asc',
    }));
    setPage(1);
  };

  const submitEdit = async () => {
    if (!canEditSelected || !hasChange) {
      setSubmitStatus({ type: 'error', message: '수정 가능한 행과 필드를 선택하고 변경 후 값을 입력해 주세요.' });
      return;
    }
    const previewErrors = safeArray(preview?.validations).filter((item) => item.level === 'error');
    if (previewLoading) {
      setSubmitStatus({ type: 'pending', message: '저장 전 검증이 끝난 뒤 승인 요청할 수 있습니다.' });
      return;
    }
    if (previewErrors.length) {
      setSubmitStatus({ type: 'error', message: text(previewErrors[0].message, '검증 오류를 먼저 확인해 주세요.') });
      return;
    }
    setSubmitStatus({ type: 'pending', message: '승인 요청을 저장하는 중입니다.' });
    try {
      await invoke('data-management/submit-edit', {
        edit_mode: 'view_field',
        view_key: effectiveViewKey,
        row_key: selectedRow.row_key,
        field_key: selectedFieldKey,
        requested_value: draftValue,
        revision_hash: selectedRow.revision_hash,
        bundle_key: bundleKey !== MANAGEMENT_ALL_OPTION ? bundleKey : '',
        reason,
      });
      setSubmitStatus({ type: 'success', message: '승인 요청이 저장되었습니다. 우측 이력과 승인/감사 영역에서 readback 상태를 확인할 수 있습니다.' });
      reloadRows({}, { force: true });
      reloadViews({}, { force: true });
    } catch (submitError) {
      setSubmitStatus({ type: 'error', message: submitError.message || '승인 요청 저장에 실패했습니다.' });
    }
  };

  const reloadAll = () => {
    reloadViews({}, { force: true });
    reloadRows({}, { force: true });
  };

  const currentRowCount = Number(pagination.total_estimate || rows.length || 0);

  return (
    <div className="space-y-5" data-data-management-redesign="true" data-data-management-view-contract="20260625-view-v1">
      <ModuleHeader
        eyebrow="DATA MANAGEMENT"
        title="데이터 관리"
        right={(
          <button type="button" onClick={reloadAll} className="h-10 rounded-[8px] border border-[#3A3A3C] px-4 text-[13px] font-semibold text-white hover:border-[#8E8E93]">
            데이터 다시 읽기
          </button>
        )}
      />

      <section className={`${CARD} p-5`}>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_320px] xl:items-start">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2" data-data-management-space-tabs="true">
              {(spaces.length ? spaces : [
                { key: 'igis', label: '이지스 Data' },
                { key: 'market', label: '시장 Data' },
                { key: 'operations', label: '시스템·운영 Data' },
              ]).map((space) => (
                <button
                  key={space.key}
                  type="button"
                  onClick={() => { setSpaceKey(space.key); setViewKey(''); setPage(1); setSelectedRowKey(''); setBundleKey(MANAGEMENT_ALL_OPTION); setShowAllFields(false); }}
                  className={`h-10 rounded-[8px] border px-4 text-[13px] font-semibold ${spaceKey === space.key ? 'border-white bg-white text-[#1F1F1E]' : 'border-[#3A3A3C] text-[#C7C7CC] hover:border-[#8E8E93]'}`}
                >
                  {space.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(260px,420px)_1fr]">
              {spaceKey === 'igis' ? (
                <label className="text-[12px] font-semibold text-[#A1A1AA]">
                  자산 · 펀드 묶음
                  <select value={bundleKey} onChange={(event) => { setBundleKey(event.target.value); setPage(1); setSelectedRowKey(''); }} className="mt-2 h-11 w-full rounded-[8px] border border-[#3A3A3C] bg-[#171717] px-3 text-[13px] text-white outline-none">
                    <option value={MANAGEMENT_ALL_OPTION}>전체 자산 · 펀드</option>
                    {bundles.map((bundle) => (
                      <option key={bundle.bundle_key} value={bundle.bundle_key}>{bundle.selection_label}</option>
                    ))}
                  </select>
                </label>
              ) : (
                <div className={`${INNER} px-4 py-3 text-[12px] leading-5 text-[#A1A1AA]`}>
                  {spaceKey === 'market' ? '시장 Data는 자산·펀드 선택 없이 원천 버전, 시트, 시점, 권역, 상·저온, 거래유형 중심으로 탐색합니다.' : '시스템·운영 Data는 일반 셀 편집 대신 readback, 이력, 전용 workflow 중심으로 확인합니다.'}
                </div>
              )}
              <label className="text-[12px] font-semibold text-[#A1A1AA]">
                통합 검색
                <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} className="mt-2 h-11 w-full rounded-[8px] border border-[#3A3A3C] bg-[#171717] px-3 text-[13px] text-white outline-none focus:border-[#8E8E93]" placeholder="자산, 펀드, 임차인, 주소, 시트명 검색" />
              </label>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <MetricCard label="관리 자산" value={viewsLoading ? '조회 중' : `${formatNumber(scope.readable_asset_count || scope.asset_count || 0)}개`} />
            <MetricCard label="관리 펀드" value={viewsLoading ? '조회 중' : `${formatNumber(scope.readable_fund_count || scope.fund_count || 0)}개`} />
            <MetricCard label="업무 View" value={viewsLoading ? '조회 중' : `${formatNumber(views.length)}개`} />
            <MetricCard label="현재 rows" value={rowsLoading ? '조회 중' : `${formatNumber(rows.length)}건`} />
          </div>
        </div>
      </section>

      {viewsError ? <div className="rounded-[12px] border border-[#4C2F2F] bg-[#2B1717] px-4 py-3 text-[13px] text-[#FFB4B4]">{viewsError}</div> : null}
      {rowsError ? <div className="rounded-[12px] border border-[#4C2F2F] bg-[#2B1717] px-4 py-3 text-[13px] text-[#FFB4B4]">{rowsError}</div> : null}

      <div className="grid grid-cols-1 gap-5 2xl:grid-cols-[280px_minmax(0,1fr)_360px]">
        <aside className={`${CARD} p-4`}>
          <div className="mb-3 text-[13px] font-semibold text-white">업무 View</div>
          <div className="space-y-2" data-data-management-domain-nav="true">
            {viewsForSpace.map((view) => {
              const active = view.view_key === effectiveViewKey;
              return (
                <button
                  key={view.view_key}
                  type="button"
                  onClick={() => { setViewKey(view.view_key); setPage(1); setSelectedRowKey(''); setShowAllFields(false); }}
                  className={`w-full rounded-[10px] border px-3 py-3 text-left ${active ? 'border-white bg-white text-[#1F1F1E]' : 'border-[#333333] bg-[#1F1F1E] text-white hover:border-[#8E8E93]'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-bold">{view.label}</span>
                    <span className={`text-[11px] ${active ? 'text-[#3A3A3C]' : 'text-[#A1A1AA]'}`}>{capabilityLabel(view.capability)}</span>
                  </div>
                  <div className={`mt-1 text-[11px] leading-4 ${active ? 'text-[#3A3A3C]' : 'text-[#86868B]'}`}>{text(view.description, '업무 단위로 정리한 데이터입니다.')}</div>
                </button>
              );
            })}
          </div>
        </aside>

        <section className={`${CARD} min-w-0 p-5`}>
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#86868B]">{text(selectedView.row_unit_label, '업무 View')}</div>
              <h3 className="mt-1 text-[22px] font-bold text-white">{text(selectedView.label, '업무 데이터')}</h3>
            </div>
            <div className="text-right text-[12px] leading-5 text-[#A1A1AA]">
              <div>{writeModeLabel}</div>
              <div>{formatNumber(currentRowCount)}건 기준</div>
            </div>
          </div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3" data-data-management-table-tabs="true">
            <div className="flex flex-wrap gap-2">
            {viewsForSpace.map((view) => (
              <button
                key={view.view_key}
                type="button"
                onClick={() => { setViewKey(view.view_key); setPage(1); setSelectedRowKey(''); setShowAllFields(false); }}
                className={`h-9 rounded-[8px] border px-3 text-[12px] font-semibold ${effectiveViewKey === view.view_key ? 'border-white bg-white text-[#1F1F1E]' : 'border-[#3A3A3C] text-[#C7C7CC] hover:border-[#8E8E93]'}`}
              >
                {view.label}
              </button>
            ))}
            </div>
            <button type="button" onClick={() => setShowAllFields((current) => !current)} className="h-9 rounded-[8px] border border-[#3A3A3C] px-3 text-[12px] font-semibold text-white hover:border-[#8E8E93]">
              {showAllFields ? '기본 컬럼만 보기' : '전체 컬럼 보기'}
            </button>
          </div>

          <div className="overflow-hidden rounded-[12px] border border-[#333333]" data-data-management-grid="true">
            <div className="max-h-[560px] overflow-auto">
              <table className="w-full min-w-[1180px] border-separate text-left text-[12px]" style={{ borderSpacing: 0 }}>
                <thead className="sticky top-0 z-30 bg-[#1F1F1E] text-[#A1A1AA]">
                  <tr>
                    <th rowSpan={2} className="sticky left-0 z-40 w-[300px] border-b border-r border-[#333333] bg-[#1F1F1E] px-3 py-2 font-semibold">관리 대상</th>
                    {columnGroups.map((group) => (
                      <th key={group.label} colSpan={group.columns.length} className="border-b border-r border-[#333333] bg-[#202020] px-3 py-2 text-center text-[11px] font-bold text-[#D1D1D6]">
                        {group.label}
                      </th>
                    ))}
                  </tr>
                  <tr>
                    {visibleColumns.map((column) => {
                      const key = text(column.field_key || column.field);
                      const activeSort = sort.key === key;
                      return (
                        <th key={key} style={{ minWidth: column.width || 150 }} className="border-b border-r border-[#333333] bg-[#1F1F1E] px-3 py-2 font-semibold">
                          <button type="button" onClick={() => changeSort(key)} className="flex w-full items-center justify-between gap-2 text-left">
                            <span className="truncate" title={text(column.label)}>{text(column.label)}</span>
                            <span className="text-[10px] text-[#86868B]">{activeSort ? (sort.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
                          </button>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#303033]">
                  {rows.length ? rows.map((row) => {
                    const selected = row.row_key === selectedRow?.row_key;
                    const values = row.display_values && typeof row.display_values === 'object' ? row.display_values : {};
                    const lookup = row.lookup_status && typeof row.lookup_status === 'object' ? row.lookup_status : {};
                    return (
                      <tr key={row.row_key} onClick={() => setSelectedRowKey(row.row_key)} className={`${selected ? 'bg-[#243044]' : 'bg-[#171717] hover:bg-[#1F1F1F]'} text-[#E5E5E5]`}>
                        <td className="sticky left-0 z-20 w-[300px] border-r border-[#303033] bg-inherit px-3 py-2 align-top">
                          <button type="button" className="block max-w-[270px] truncate text-left font-semibold text-white" title={text(row.row_label)}>{text(row.row_label, '행')}</button>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                            <span className={lookup.status === 'missing' ? 'text-[#FFD479]' : lookup.status === 'exception_404' ? 'text-[#9AD7FF]' : 'text-[#B5E48C]'}>{text(lookup.label, '정상')}</span>
                            <span className="text-[#86868B]">{row.editable ? '수정 요청 가능' : writeModeLabel}</span>
                          </div>
                        </td>
                        {visibleColumns.map((column) => {
                          const key = text(column.field_key || column.field);
                          const cellChanged = selected && key === selectedFieldKey && hasChange;
                          return (
                            <td key={`${row.row_key}-${key}`} className={`max-w-[260px] border-r border-[#242426] px-3 py-2 align-top ${cellChanged ? 'bg-[#1E2A1B] text-white' : ''}`}>
                              <button
                                type="button"
                                onClick={(event) => { event.stopPropagation(); setSelectedRowKey(row.row_key); setSelectedField(key); }}
                                className="block w-full truncate text-left"
                                title={formatDisplayValue(values[key], key)}
                              >
                                {formatDisplayValue(values[key], key)}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  }) : (
                    <tr>
                      <td colSpan={visibleColumns.length + 1} className="bg-[#171717] px-4 py-10 text-center text-[#A1A1AA]">
                        {rowsLoading ? '데이터를 불러오는 중입니다.' : text(rowsData?.empty_state?.title, '현재 조건 0건입니다.')}
                        {!rowsLoading ? <div className="mt-2 text-[12px] text-[#86868B]">{text(rowsData?.empty_state?.description, '다른 업무 View, 자산·펀드 묶음, 검색 조건을 선택해 주세요.')}</div> : null}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[12px] text-[#A1A1AA]">
            <div>페이지 {formatNumber(page)} · 표시 {formatNumber(rows.length)}건</div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1} className="h-8 rounded-[7px] border border-[#3A3A3C] px-3 font-semibold text-white disabled:opacity-35">이전</button>
              <button type="button" onClick={() => setPage((current) => current + 1)} disabled={pagination.has_next === false || rows.length < 80} className="h-8 rounded-[7px] border border-[#3A3A3C] px-3 font-semibold text-white disabled:opacity-35">다음</button>
            </div>
          </div>
        </section>

        <aside className={`${CARD} p-5`} data-data-management-change-basket="true">
          <ModuleHeader eyebrow="CHANGE BASKET" title="검증 및 승인 요청" />
          <div className={`${INNER} mt-4 p-4`}>
            <div className="text-[12px] font-semibold text-[#A1A1AA]">선택 행</div>
            <div className="mt-2 text-[15px] font-bold text-white">{selectedRow ? text(selectedRow.row_label, '행') : '행을 선택해 주세요'}</div>
            <div className="mt-1 text-[12px] text-[#86868B]">{text(selectedView.label)} · {writeModeLabel}</div>
          </div>

          <label className="mt-4 block text-[12px] font-semibold text-[#A1A1AA]">
            수정 필드
            <select value={selectedFieldKey} onChange={(event) => setSelectedField(event.target.value)} disabled={!editableColumns.length} className="mt-2 h-10 w-full rounded-[8px] border border-[#3A3A3C] bg-[#171717] px-3 text-white outline-none disabled:opacity-50">
              {editableColumns.length ? editableColumns.map((column) => {
                const key = text(column.field_key || column.field);
                return <option key={key} value={key}>{text(column.group)} · {text(column.label)}</option>;
              }) : <option value="">이 영역은 읽기 전용입니다</option>}
            </select>
          </label>
          <label className="mt-4 block text-[12px] font-semibold text-[#A1A1AA]">
            변경 전
            <textarea value={beforeDisplayValue} readOnly className="mt-2 h-24 w-full resize-none rounded-[8px] border border-[#333333] bg-[#151515] px-3 py-2 text-[13px] text-[#C7C7CC] outline-none" />
          </label>
          <label className="mt-4 block text-[12px] font-semibold text-[#A1A1AA]">
            변경 후
            <textarea value={draftValue} onChange={(event) => setDraftValue(event.target.value)} disabled={!canEditSelected} className="mt-2 h-24 w-full resize-none rounded-[8px] border border-[#3A3A3C] bg-[#171717] px-3 py-2 text-[13px] text-white outline-none focus:border-[#8E8E93] disabled:opacity-45" placeholder={canEditSelected ? '수정할 값을 입력해 주세요.' : '수정 가능한 필드를 선택해 주세요.'} />
          </label>
          <label className="mt-4 block text-[12px] font-semibold text-[#A1A1AA]">
            변경 사유
            <input value={reason} onChange={(event) => setReason(event.target.value)} disabled={!canEditSelected} className="mt-2 h-10 w-full rounded-[8px] border border-[#3A3A3C] bg-[#171717] px-3 text-white outline-none focus:border-[#8E8E93] disabled:opacity-45" placeholder="승인자가 이해할 수 있는 수정 사유" />
          </label>

          <div className={`${INNER} mt-4 p-4`}>
            <div className="text-[12px] font-semibold text-white">저장 전 검증</div>
            {previewLoading ? (
              <div className="mt-2 text-[12px] text-[#A1A1AA]">DB readback으로 현재 값을 다시 확인하는 중입니다.</div>
            ) : safeArray(preview?.validations).length ? (
              <div className="mt-2 space-y-1">
                {safeArray(preview?.validations).map((item, index) => (
                  <div key={`${item.code || 'validation'}-${index}`} className={`text-[12px] leading-5 ${item.level === 'error' ? 'text-[#FF9F9F]' : item.level === 'warning' ? 'text-[#FFD479]' : 'text-[#A1A1AA]'}`}>{text(item.message)}</div>
                ))}
              </div>
            ) : (
              <div className="mt-2 text-[12px] text-[#A1A1AA]">{hasChange ? '검증 오류가 없습니다.' : '변경할 값을 입력하면 검증합니다.'}</div>
            )}
          </div>

          <button
            type="button"
            onClick={submitEdit}
            disabled={!canEditSelected || !hasChange || previewLoading || safeArray(preview?.validations).some((item) => item.level === 'error')}
            className="mt-4 h-11 w-full rounded-[8px] bg-white px-4 text-[13px] font-bold text-[#1F1F1E] hover:bg-[#E5E5E5] disabled:cursor-not-allowed disabled:opacity-35"
          >
            승인 요청 저장
          </button>
          {submitStatus ? <div className={`mt-3 text-[12px] leading-5 ${submitStatus.type === 'error' ? 'text-[#FF9F9F]' : submitStatus.type === 'success' ? 'text-[#B5E48C]' : 'text-[#A1A1AA]'}`}>{submitStatus.message}</div> : null}
        </aside>
      </div>
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
