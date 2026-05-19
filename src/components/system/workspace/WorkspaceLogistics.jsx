import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../../utils/supabaseClient';
import { useAuth } from '../../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';
import weeklyReportData from './logisticsWeeklyReportData.json';
import logisticsPermissionData from './logisticsPermissionData.json';
import WorkspaceActivityLog from './WorkspaceActivityLog';
import homeData from './logisticsHomeData.json';
import assetOptionsData from './logisticsAssetOptionsData.json';
import companyOptionsData from './logisticsCompanyOptionsData.json';
import sectorData from './logisticsSectorData.json';

const MotionDiv = motion.div;

const assetPayloadModules = import.meta.glob('./logisticsAssetData/*.json', { eager: true });
const ASSET_PAYLOADS = Object.fromEntries(Object.values(assetPayloadModules)
  .map((module) => module.default)
  .filter(Boolean)
  .map((payload) => [payload.overview?.assetId || payload.meta?.selection?.assetId, payload]));
const companyPayloadModules = import.meta.glob('./logisticsCompanyData/*.json', { eager: true });
const getModuleStem = (modulePath) => modulePath.split('/').pop()?.replace(/\.json$/u, '');
const COMPANY_PAYLOADS = Object.fromEntries(Object.entries(companyPayloadModules)
  .map(([modulePath, module]) => {
    const payload = module.default;
    const tenantId = payload?.meta?.selection?.tenantId
      || payload?.filters?.selectedTenantId
      || payload?.profile?.tenantId
      || getModuleStem(modulePath);

    return payload && tenantId ? [tenantId, payload] : null;
  })
  .filter(Boolean));

const MODULES = [
  { id: 'home', label: 'Home', source: 'Home' },
  { id: 'asset', label: 'Asset', source: 'Asset' },
  { id: 'company', label: 'Company', source: 'Company' },
  { id: 'tools', label: 'Analysis Tools', source: 'Analysis Tools' },
  { id: 'playground', label: 'Data Playground', source: 'Data Playground' },
  { id: 'quality', label: 'Data Quality', source: 'Data Quality' },
];
const ADMIN_ONLY_MODULE_IDS = new Set(['tools', 'playground', 'quality']);

const WORKLOGS = [
  { id: 'wl-001', title: '주간 임대차 변동사항 확인', scope: '개인', owner: '물류 AM', status: '진행', priority: '높음', due: '이번 주', asset: 'DB_일반', note: '만기, 공실, 임대료 변동 항목 우선 확인' },
  { id: 'wl-002', title: '자산별 임차인 상세 검토', scope: '팀', owner: '리싱 담당', status: '검토', priority: '보통', due: 'D+3', asset: 'Asset', note: '원본 Asset 탭 상세 화면 기준 유지' },
  { id: 'wl-003', title: '기업 노출 및 OpenDART 연결 준비', scope: '팀', owner: '데이터 담당', status: '보류', priority: '보통', due: 'API 모듈', asset: 'Company', note: '서버 연결 전 외부 API 기능 비노출' },
  { id: 'wl-004', title: '섹터 전체 공실/만기 리스크 점검', scope: '섹터', owner: '섹터 PM', status: '진행', priority: '높음', due: '이번 주', asset: 'Sector', note: 'Home/Sector 숫자 불일치 금지' },
  { id: 'wl-005', title: '데이터 품질 null 사유 분류', scope: '섹터', owner: '데이터 QA', status: '보류', priority: '높음', due: 'Data QA 모듈', asset: 'Data Quality', note: '품질 점검 모듈에서 사유별로 분류' },
];

const WEEKLY_ITEMS = [
  { label: '자산', value: '17', tone: 'text-[#B5E48C]' },
  { label: '임차인', value: '36', tone: 'text-[#9AD7FF]' },
  { label: '계약', value: '45', tone: 'text-[#FFD166]' },
  { label: '이슈', value: '42', tone: 'text-[#FF9F9F]' },
];

const DATA_STATUS = [
  { label: '정규화 데이터', value: '확인', detail: '검증 기준 통과' },
  { label: '원본 연결', value: '미연결 0건', detail: '원본 행 연결 확인' },
  { label: 'API 미인증 차단', value: '차단 확인', detail: '미인증 요청 차단' },
  { label: '외부 API 연결', value: '준비', detail: '서버 연결 후 노출' },
];

const PRIMARY_BLUE_BUTTON_CLASS = 'border-[#3b82f6]/30 bg-[#3b82f6]/20 text-[#60a5fa] hover:bg-[#3b82f6]/30';
const DARK_BUTTON_CLASS = 'border-[#333333] bg-[#222] text-[#D1D1D6] hover:border-[#555] hover:text-white';
const DATA_QUALITY_ALLOWED_NAMES = new Set(['이시정', '전기영', '이관용']);
const DASHBOARD_BASIS_LABEL = '2026년 4월 기준';
const USE_CATEGORY_COLORS = {
  상온창고: '#F59E0B',
  저온창고: '#7DD3FC',
  복합: '#A78BFA',
  사무실: '#9CA3AF',
};

const STATUS_STYLES = {
  진행: 'bg-[#173522] text-[#B5E48C] border-[#2E6B45]',
  검토: 'bg-[#2B2613] text-[#FFD166] border-[#7A6425]',
  보류: 'bg-[#331F1F] text-[#FF9F9F] border-[#6F3434]',
};

const WEEKLY_ASSET_DB_CONTEXT = {
  아레나스안성: { assetName: '아레나스안성', fundName: '이지스아레나스케이엘아이피1의2사모부동산모투자회사' },
  여주본두리: { assetName: '여주 본두리 물류센터', fundName: '이지스제440호부동산일반사모투자회사', leaseMaturity: '2030-02-28' },
  화성석포리: { assetName: '화성 석포리 물류센터', fundName: '이지스일반사모부동산투자신탁제451호(운용)' },
  경산쿠팡물류: { assetName: '경산 쿠팡물류센터', fundName: '이지스경산로지스제1호일반사모부동산투자회사(운용)', leaseMaturity: '2030-05-01' },
  스카이박스1: { assetName: '스카이박스1, 스카이박스2', fundName: '이지스아레나스전문투자형사모부동산투자신탁4호', leaseMaturity: '2029-04-01' },
  스카이박스2: { assetName: '스카이박스1, 스카이박스2', fundName: '이지스아레나스전문투자형사모부동산투자신탁4호', leaseMaturity: '2029-04-01' },
  이천동산: { assetName: '동산물류센터', fundName: '이지스전문투자형사모부동산투자신탁제404호', leaseMaturity: '2028-01-11' },
  에이블로지스: { assetName: '에이블로지스물류센터', fundName: '이지스전문투자형사모부동산투자신탁제404호', leaseMaturity: '2028-03-31' },
  부국물류: { assetName: '부국물류센터', fundName: '이지스전문투자형사모부동산투자신탁제404호' },
  창원두동LG: { assetName: '두동 LG전자 통합물류센터', fundName: '이지스제505호부동산일반사모투자회사', leaseMaturity: '2026-12-15' },
  이천회억리: { assetName: '이천 마장면 물류센터', fundName: '이지스일반사모부동산투자신탁제426호(운용)' },
  부산송정: { assetName: '부산송정물류센터', fundName: '이지스제114호전문투자형사모부동산투자유한회사' },
  안성성은리: { assetName: '안성 성은지구 물류센터', fundName: '안성성은물류피에프브이 주식회사', leaseMaturity: '2028-06-30' },
  경남양산석암: { assetName: '양산 유산동 물류센터', fundName: '주식회사 석암물류(SPC)' },
  야탑쿠팡물류: { assetName: '야탑쿠팡물류', fundName: '미분류 펀드' },
  포천정교리: { assetName: '포천정교리', fundName: '미분류 펀드' },
  아레나스양지: { assetName: '아레나스양지물류센터', fundName: '이지스일반사모부동산모투자신탁116호', leaseMaturity: '2034-02-28' },
  인천석남물류: { assetName: '인천석남물류센터', fundName: '이지스인컴앤그로스제2의4호일반사모부동산모투자회사', leaseMaturity: '2034-06-12' },
  평택아디다스: { assetName: '평택아디다스물류센터', fundName: '이지스인컴앤그로스일반사모부동산자투자신탁제2-2호', leaseMaturity: '2027-08-31' },
  안성홈플러스: { assetName: '안성 홈플러스 중부허브 물류센터', fundName: '이지스인컴앤그로스제2의3호일반사모부동산모투자회사', leaseMaturity: '2032-12-20' },
};

function pathFor(suffix = '') {
  const base = 'platform/iotaseoul/workspace/logistics';
  return suffix ? `${base}/${suffix}` : base;
}

function memberAvatarSource(memberInfo, fallbackName) {
  const explicit = firstDefined(
    memberInfo?.avatar_url,
    memberInfo?.avatarUrl,
    memberInfo?.photo_url,
    memberInfo?.photoUrl,
    memberInfo?.picture,
    memberInfo?.profile_image_url,
    memberInfo?.profileImageUrl,
    memberInfo?.image_url,
  );
  if (explicit) return explicit;
  const name = String(fallbackName || memberInfo?.staff_name || memberInfo?.name || '').replace(/\s/gu, '');
  return name ? `${import.meta.env.BASE_URL}${name}.webp` : `${import.meta.env.BASE_URL}default_avatar.svg`;
}

function MemberAvatar({ memberInfo, name, sizeClass = 'h-12 w-12', textClass = 'text-[15px]' }) {
  const [imageFailed, setImageFailed] = useState(false);
  const label = String(name || memberInfo?.staff_name || memberInfo?.name || '물류').trim();
  const src = memberAvatarSource(memberInfo, label);
  return (
    <div className={`relative flex ${sizeClass} shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#E8F2FF] ${textClass} font-bold text-[#1F1F1E]`}>
      {!imageFailed ? (
        <img
          src={src}
          alt={label}
          className="h-full w-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span>{label.slice(0, 1)}</span>
      )}
      <div className="pointer-events-none absolute inset-0 rounded-full border border-white/10" />
    </div>
  );
}

function navigateTo(path) {
  const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL.slice(0, -1) : import.meta.env.BASE_URL;
  window.location.href = `${base}/${path}`;
}

function resolveAssetIdByName(assetName) {
  const normalized = String(assetName || '').replace(/\s+/g, '').toLowerCase();
  if (!normalized) return '';
  const exact = assetOptionsData.find((item) => String(item.assetName || '').replace(/\s+/g, '').toLowerCase() === normalized);
  if (exact) return exact.assetId;
  const partial = assetOptionsData.find((item) => {
    const optionName = String(item.assetName || '').replace(/\s+/g, '').toLowerCase();
    return optionName.includes(normalized) || normalized.includes(optionName);
  });
  return partial?.assetId || '';
}

function navigateToAsset(assetName) {
  const assetId = resolveAssetIdByName(assetName);
  if (assetId) window.sessionStorage.setItem('logisticsSelectedAssetId', assetId);
  navigateTo(pathFor('dashboard/asset'));
}

function navigateToCompany(tenantId) {
  if (tenantId) window.sessionStorage.setItem('logisticsSelectedTenantId', tenantId);
  navigateTo(pathFor('dashboard/company'));
}

function normalizeWeeklyAssetKey(value) {
  return String(value || '').replace(/\s+/g, '').replace(/센터|물류센터|,|㈜|\(주\)|주식회사/g, '').trim();
}

const WEEKLY_DEVELOPMENT_ASSET_KEYS = ['야탑쿠팡물류', '포천정교리'].map((value) => value.replace(/\s+/gu, '').toLowerCase());

function weeklyAssetDisplayName(value) {
  const text = cleanDisplay(value, '');
  const key = text.replace(/\s+/gu, '').toLowerCase();
  if (key.includes('스카이박스1') || key.includes('스카이박스2')) return '스카이박스1, 스카이박스2';
  return text;
}

function isWeeklyDevelopmentAsset(value) {
  const key = String(value || '').replace(/\s+/gu, '').toLowerCase();
  return WEEKLY_DEVELOPMENT_ASSET_KEYS.some((assetKey) => key.includes(assetKey));
}

function mergeWeeklyAssetValue(current, next) {
  const currentText = cleanDisplay(current, '');
  const nextText = cleanDisplay(next, '');
  if (!currentText) return nextText;
  if (!nextText || currentText === nextText) return currentText;
  return `${currentText} / ${nextText}`;
}

function resolveWeeklyAssetContext(row) {
  const key = normalizeWeeklyAssetKey(row?.assetName);
  if (WEEKLY_ASSET_DB_CONTEXT[key]) return WEEKLY_ASSET_DB_CONTEXT[key];
  const matchedKey = Object.keys(WEEKLY_ASSET_DB_CONTEXT).find((item) => key && (item.includes(key) || key.includes(item)));
  return matchedKey ? WEEKLY_ASSET_DB_CONTEXT[matchedKey] : null;
}

function cleanDisplay(value, fallback = '-') {
  const text = String(value == null ? '' : value)
    .replace(/●/g, '')
    .replace(/\s*\/\s*\/\s*/g, ' / ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return text || fallback;
}

function safeFileNameText(value) {
  return cleanDisplay(value, '파일')
    .replace(/[\\/:*?"<>|]/gu, '_')
    .replace(/\s+/gu, '_')
    .slice(0, 80);
}

function formatNumber(value) {
  if (value === undefined || value === null || value === '') return '-';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return cleanDisplay(value);
  return new Intl.NumberFormat('ko-KR').format(numeric);
}

function formatDecimalNumber(value, digits = 1) {
  if (value === undefined || value === null || value === '') return '-';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '-';
  return new Intl.NumberFormat('ko-KR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(numeric);
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '');
}

function sumRows(rows, picker) {
  return (rows || []).reduce((sum, row) => sum + Number(picker(row) || 0), 0);
}

function formatPercent(value) {
  if (value === undefined || value === null || value === '') return '-';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '-';
  if (numeric > 0 && numeric < 0.001) return '<0.1%';
  return `${(numeric * 100).toFixed(1)}%`;
}

function formatArea(value) {
  if (value === undefined || value === null || value === '') return '-';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '-';
  if (numeric <= 0) return '0.0평';
  return `${formatDecimalNumber(numeric * 0.3025, 1)}평`;
}

function calculatePerPy(totalValue, areaSqm) {
  const total = Number(totalValue || 0);
  const areaPy = Number(areaSqm || 0) * 0.3025;
  if (!Number.isFinite(total) || !Number.isFinite(areaPy) || areaPy <= 0) return null;
  return total / areaPy;
}

function formatPyFromSqm(value) {
  if (value === undefined || value === null || value === '') return '-';
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return '-';
  return `${formatDecimalNumber(Math.max(0.1, numeric * 0.3025), 1)}평`;
}

function parsePercentText(value) {
  const match = String(value || '').match(/([\d.]+)\s*%/u);
  if (!match) return null;
  const numeric = Number(match[1]);
  if (!Number.isFinite(numeric)) return null;
  return numeric / 100;
}

function formatSigunguAddress(address) {
  const parts = String(address || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '-';
  if (parts.length >= 3 && /시$/u.test(parts[1]) && /구$/u.test(parts[2])) return parts.slice(0, 3).join(' ');
  if (parts.length >= 2 && /[시군구]$/u.test(parts[1])) return parts.slice(0, 2).join(' ');
  return parts.slice(0, Math.min(2, parts.length)).join(' ');
}

function normalizeColdStorageLabel(label) {
  const value = String(label || '').trim().toUpperCase();
  if (value === 'Y') return '저온창고';
  if (value === 'N') return '상온창고';
  return cleanDisplay(label, '미분류');
}

const USE_CATEGORY_LABELS = ['상온창고', '복합', '저온창고', '사무실'];

function normalizeUseCategoryLabel(label) {
  const value = String(label || '').trim();
  const upper = value.toUpperCase();
  if (!value) return '복합';
  if (/복합|MIXED|COMPLEX|상저온|상온\s*[/+·]\s*저온|저온\s*[/+·]\s*상온/u.test(value)) return '복합';
  if (upper === 'Y' || /저온|냉동|냉장|COLD/u.test(value)) return '저온창고';
  if (upper === 'N' || /상온|창고|WAREHOUSE|AMBIENT/u.test(value)) return '상온창고';
  if (/사무|OFFICE/u.test(value)) return '사무실';
  return '복합';
}

function inferUseCategoryFromLeaseRow(row = {}) {
  const explicitTemp = String(firstDefined(row.coldStorageType, row.temperatureType, row.cold_storage_type, '') || '').trim();
  if (explicitTemp) return normalizeUseCategoryLabel(explicitTemp);
  const usageText = [
    row.useCategory,
    row.goodsType,
    row.spaceLabel,
    row.floorLabel,
    row.detailAreaLabel,
    row.tenantUse,
  ].filter(Boolean).join(' ');
  if (!usageText) return '';
  if (/복합|MIXED|COMPLEX|상저온|상온\s*[/+·]\s*저온|저온\s*[/+·]\s*상온/u.test(usageText)) return '복합';
  if (/사무|OFFICE/u.test(usageText)) return '사무실';
  return '';
}

function normalizeUseCategoryRows(rows) {
  const grouped = Object.fromEntries(USE_CATEGORY_LABELS.map((label) => [label, { label, value: 0, recordCount: 0 }]));
  (rows || []).forEach((row) => {
    const label = normalizeUseCategoryLabel(row.label || row.category || row.use || row.name);
    const value = Number(row.value || row.areaSqm || 0);
    grouped[label].value += value;
    grouped[label].recordCount += Number(row.recordCount || row.count || (value > 0 ? 1 : 0));
  });
  return USE_CATEGORY_LABELS.map((label) => grouped[label]);
}

function mergeUseCategoryRows(rowGroups) {
  const grouped = Object.fromEntries(USE_CATEGORY_LABELS.map((label) => [label, { label, value: 0, recordCount: 0 }]));
  (rowGroups || []).flat().forEach((row) => {
    const label = normalizeUseCategoryLabel(row?.label);
    grouped[label].value += Number(row?.value || 0);
    grouped[label].recordCount += Number(row?.recordCount || 0);
  });
  return USE_CATEGORY_LABELS.map((label) => grouped[label]);
}

function buildUseCategoryRows(payload, option = {}, weeklyRow = {}) {
  const normalized = payload ? normalizeAssetPayload(payload) : null;
  const overview = normalized?.overview || payload?.overview || {};
  const breakdown = normalized?.areaBreakdown || payload?.areaBreakdown || {};
  const leaseRowSummary = (normalized?.normalizedRows || []).reduce((acc, row) => {
    const label = inferUseCategoryFromLeaseRow(row);
    const area = Number(firstDefined(row.warehouseAreaSqm, row.exclusiveAreaSqm, row.leasedAreaSqm, row.areaSqm, 0) || 0);
    if (!label || !Number.isFinite(area) || area <= 0) return acc;
    if (label === '저온창고') acc.cold += area;
    if (label === '상온창고') acc.ambient += area;
    if (label === '복합') acc.composite += area;
    if (label === '사무실') acc.office += area;
    acc.counts[label] += 1;
    return acc;
  }, {
    cold: 0,
    ambient: 0,
    composite: 0,
    office: 0,
    counts: { 상온창고: 0, 복합: 0, 저온창고: 0, 사무실: 0 },
  });
  const grossArea = Number(firstDefined(breakdown.grossFloorAreaSqm, overview.grossFloorAreaSqm, option.grossFloorAreaSqm, 0) || 0);
  const officeArea = Number(firstDefined(breakdown.officeAreaSqm, overview.officeAreaSqm, option.officeAreaSqm, 0) || 0);
  let coldArea = Number(firstDefined(overview.coldStorageAreaSqm, breakdown.coldStorageAreaSqm, option.coldStorageAreaSqm, 0) || 0);
  const ambientDirect = firstDefined(overview.ambientStorageAreaSqm, breakdown.ambientStorageAreaSqm, option.ambientStorageAreaSqm);
  const warehouseArea = Number(firstDefined(breakdown.warehouseAreaSqm, overview.warehouseAreaSqm, option.warehouseAreaSqm, 0) || 0);
  let ambientArea = Number(ambientDirect != null ? ambientDirect : Math.max(warehouseArea - coldArea, 0));
  const coldRatioText = String(firstDefined(overview.coldRatio, option.coldRatio, weeklyRow.coldRatio, '') || '');
  const coldRatioValue = parsePercentText(coldRatioText);
  if (coldArea <= 0 && coldRatioValue && grossArea > 0) {
    const storageBase = warehouseArea > 0 ? warehouseArea : Math.max(grossArea - officeArea, grossArea, 0);
    coldArea = storageBase * coldRatioValue;
    if (ambientDirect == null) ambientArea = Math.max(storageBase - coldArea, 0);
  }
  if (coldArea <= 0 && leaseRowSummary.cold > 0) coldArea = leaseRowSummary.cold;
  if (ambientDirect == null && ambientArea <= 0 && leaseRowSummary.ambient > 0) ambientArea = leaseRowSummary.ambient;
  const explicitCompositeArea = Number(firstDefined(overview.compositeAreaSqm, breakdown.compositeAreaSqm, option.compositeAreaSqm, 0) || 0);
  let compositeArea = explicitCompositeArea > 0 ? explicitCompositeArea : leaseRowSummary.composite;
  if (ambientDirect == null && compositeArea > 0 && warehouseArea > 0) {
    ambientArea = Math.max(warehouseArea - coldArea - compositeArea, 0);
  }
  const effectiveOfficeArea = officeArea || leaseRowSummary.office;
  const hasExplicitStorage = coldArea > 0 || ambientArea > 0 || effectiveOfficeArea > 0 || compositeArea > 0;
  const fallbackLabel = /저온|Y/i.test(coldRatioText) ? '저온창고' : /상온|N/i.test(coldRatioText) ? '상온창고' : '복합';
  const rows = [
    { label: '상온창고', value: ambientArea, recordCount: leaseRowSummary.counts.상온창고 || (ambientArea > 0 ? 1 : 0) },
    { label: '복합', value: compositeArea, recordCount: leaseRowSummary.counts.복합 || (compositeArea > 0 ? 1 : 0) },
    { label: '저온창고', value: coldArea, recordCount: leaseRowSummary.counts.저온창고 || (coldArea > 0 ? 1 : 0) },
    { label: '사무실', value: effectiveOfficeArea, recordCount: leaseRowSummary.counts.사무실 || (effectiveOfficeArea > 0 ? 1 : 0) },
  ];
  if (!hasExplicitStorage && grossArea > 0) {
    return USE_CATEGORY_LABELS.map((label) => ({
      label,
      value: label === fallbackLabel ? grossArea : 0,
      recordCount: label === fallbackLabel ? 1 : 0,
    }));
  }
  return rows;
}

function calculateWeightedENoc(rows, fallbackValue) {
  const weighted = (rows || []).reduce((acc, row) => {
    const area = Number(firstDefined(row.leasedAreaSqm, row.currentLeasedAreaSqm, row.totalLeasedAreaSqm, row.areaSqm));
    const eNoc = Number(firstDefined(
      row.eNoc,
      row.averageENoc,
      row.currentENoc,
      row.currentENocPerPy,
      calculatePerPy(firstDefined(row.monthlyCombinedTotal, row.monthlyCostTotal, row.currentMonthlyCostTotal), area),
    ));
    if (!Number.isFinite(eNoc) || !Number.isFinite(area) || eNoc <= 0 || area <= 0) return acc;
    return {
      weightedSum: acc.weightedSum + eNoc * area,
      areaSum: acc.areaSum + area,
    };
  }, { weightedSum: 0, areaSum: 0 });
  if (weighted.areaSum > 0) return weighted.weightedSum / weighted.areaSum;
  return fallbackValue;
}

function buildBuildingRegisterPayload(source = {}) {
  const asset = source.asset || source;
  const sigunguCd = firstDefined(asset.sigunguCd, asset.sigungu_cd, asset.sigungu);
  const bjdongCd = firstDefined(asset.bjdongCd, asset.bjdong_cd, asset.bjdong);
  const platGbCd = firstDefined(asset.platGbCd, asset.plat_gb_cd, '0');
  const bun = firstDefined(asset.bun, asset.mainBun);
  const ji = firstDefined(asset.ji, asset.subBun, '0');
  return {
    sigungu_cd: sigunguCd ? String(sigunguCd) : '',
    bjdong_cd: bjdongCd ? String(bjdongCd) : '',
    plat_gb_cd: platGbCd ? String(platGbCd) : '0',
    bun: bun ? String(bun).padStart(4, '0') : '',
    ji: ji ? String(ji).padStart(4, '0') : '0000',
  };
}

function isCompleteBuildingRegisterPayload(payload = {}) {
  return Boolean(payload.sigungu_cd && payload.bjdong_cd && payload.bun && payload.ji);
}

function compactCompositionRows(rows, limit = 8, otherLabel = '기타') {
  const positiveRows = (rows || [])
    .filter((row) => Number(row.value || 0) > 0)
    .sort((a, b) => Number(b.value || 0) - Number(a.value || 0));
  if (positiveRows.length <= limit) return positiveRows;
  const visibleRows = positiveRows.slice(0, Math.max(limit - 1, 1));
  const restRows = positiveRows.slice(Math.max(limit - 1, 1));
  return [
    ...visibleRows,
    {
      label: otherLabel,
      value: sumRows(restRows, (row) => row.value),
      recordCount: sumRows(restRows, (row) => row.recordCount || 0),
    },
  ];
}

function findAssetPayload(assetId, assetName) {
  if (assetId && ASSET_PAYLOADS[assetId]) return ASSET_PAYLOADS[assetId];
  const normalizedName = String(assetName || '').replace(/\s+/gu, '');
  if (!normalizedName) return null;
  return Object.values(ASSET_PAYLOADS).find((payload) => {
    const payloadName = String(payload?.overview?.assetName || payload?.meta?.selection?.assetName || '').replace(/\s+/gu, '');
    return payloadName === normalizedName;
  }) || null;
}

function findAssetOption(assetId, assetName) {
  const normalizedName = normalizeAssetNameKey(assetName);
  return assetOptionsData.find((item) => item.assetId === assetId)
    || assetOptionsData.find((item) => normalizeAssetNameKey(item.assetName) === normalizedName)
    || assetOptionsData.find((item) => {
      const key = normalizeAssetNameKey(item.assetName);
      return key && normalizedName && (key.includes(normalizedName) || normalizedName.includes(key));
    })
    || null;
}

function formatCurrency(value) {
  if (value === undefined || value === null || value === '') return '-';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '-';
  if (Math.abs(numeric) >= 100000000) return `${formatDecimalNumber(numeric / 100000000, 1)}억`;
  if (Math.abs(numeric) >= 10000) return `${formatNumber(Math.round(numeric / 10000))}만`;
  return formatNumber(Math.round(numeric));
}

function formatWon(value) {
  if (value === undefined || value === null || value === '') return '-';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '-';
  return `${formatNumber(Math.round(numeric))}원`;
}

function formatDate(value) {
  return String(value || '-').slice(0, 10);
}

function monthsUntil(dateValue, baseDate = new Date()) {
  const target = new Date(dateValue);
  if (Number.isNaN(target.getTime())) return null;
  return Math.max(0, (target.getFullYear() - baseDate.getFullYear()) * 12 + target.getMonth() - baseDate.getMonth());
}

function formatBusinessRegistrationNo(value, tenantId = '') {
  const raw = String(value || '').replace(/\D/gu, '');
  const fallback = String(tenantId || '').match(/tenant_brn_(\d{10})/u)?.[1] || '';
  const digits = raw || fallback;
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
  return value || (digits || '-');
}

function formatNewlyAddedAssets(row = {}, emptyLabel = '-') {
  const assets = Array.isArray(row.newlyAddedAssets) ? row.newlyAddedAssets : [];
  const names = assets
    .map((asset) => cleanDisplay(asset?.assetName || asset?.name, ''))
    .filter(Boolean);
  if (!names.length) return emptyLabel;
  return names.join(', ');
}

function formatMetric(value, type) {
  if (type === 'area') return formatArea(value);
  if (type === 'currency') return formatCurrency(value);
  if (type === 'won') return formatWon(value);
  if (type === 'percent') return formatPercent(value);
  if (type === 'date') return formatDate(value);
  if (type === 'count') return `${formatNumber(value)}개`;
  if (type === 'months') return `${formatNumber(value)}개월`;
  return formatNumber(value);
}

function normalizeWeeklyAssetRows(rows) {
  const grouped = new Map();
  (rows || []).filter((row) => !isWeeklyDevelopmentAsset(row?.assetName)).forEach((row) => {
    const context = resolveWeeklyAssetContext(row) || {};
    const displayName = weeklyAssetDisplayName(context.assetName || row.assetName || '-');
    const current = grouped.get(displayName);
    const next = {
      ...row,
      originalAssetName: row.originalAssetName || row.assetName || '',
      assetName: displayName,
      fundName: cleanDisplay(row.fundName || context.fundName, ''),
      leaseMaturity: row.leaseMaturity || context.leaseMaturity || '',
    };
    if (!current) {
      grouped.set(displayName, next);
      return;
    }
    grouped.set(displayName, {
      ...current,
      originalAssetName: mergeWeeklyAssetValue(current.originalAssetName, next.originalAssetName),
      fundName: current.fundName || next.fundName,
      category: current.category || next.category,
      grossAreaPy: Number(current.grossAreaPy || 0) + Number(next.grossAreaPy || 0) || current.grossAreaPy || next.grossAreaPy,
      overview: mergeWeeklyAssetValue(current.overview || current.status, next.overview || next.status),
      status: mergeWeeklyAssetValue(current.status, next.status),
      mainIssue: mergeWeeklyAssetValue(current.mainIssue, next.mainIssue),
      mainTenant: mergeWeeklyAssetValue(current.mainTenant, next.mainTenant),
      occupancyRate: current.occupancyRate || next.occupancyRate,
      coldRatio: current.coldRatio || next.coldRatio,
      leaseMaturity: current.leaseMaturity || next.leaseMaturity,
    });
  });
  return [...grouped.values()];
}

function projectSummaryRows(row, section) {
  const planLabel = section === 'newProjects' ? '운영 메모' : '계획';
  return [
    ['프로젝트', row.projectName || row.assetName || '-'],
    ['리스크/자금', cleanDisplay(row.risk || row.funding, '검토')],
    ['진행 상태', renderBulletListCell(row.status)],
    ['주요 이슈', renderBulletListCell(row.issue)],
    [planLabel, renderBulletListCell(row.plan)],
  ];
}

function renderBulletListCell(value) {
  const bullets = splitTaskBullets(value);
  if (!bullets.length) return '-';
  if (bullets.length === 1) return cleanDisplay(bullets[0]);
  return (
    <ul className="space-y-1 whitespace-normal break-keep pl-4 text-left leading-5">
      {bullets.map((item, index) => (
        <li key={`${item}-${index}`} className="list-disc">{item}</li>
      ))}
    </ul>
  );
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function dateToYmd(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function addCalendarDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfMondayWeekDate(date) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + diff);
  return next;
}

function buildWeeklyYearOptions() {
  const currentYear = new Date().getFullYear();
  const generated = Array.from({ length: 11 }, (_, index) => String(currentYear - 5 + index));
  return [...new Set([...generated, ...WEEKLY_REPORT_LIBRARY.map((item) => item.year)])].sort();
}

function buildWeeklyMonthOptions() {
  return Array.from({ length: 12 }, (_, index) => pad2(index + 1));
}

function buildWeeklyWeekOptions(year, month) {
  const yearNumber = Number(year);
  const monthNumber = Number(month);
  if (!Number.isFinite(yearNumber) || !Number.isFinite(monthNumber)) return [];
  const firstDate = new Date(yearNumber, monthNumber - 1, 1);
  const lastDate = new Date(yearNumber, monthNumber, 0);
  const monthIndex = monthNumber - 1;
  const options = [];
  for (let cursor = startOfMondayWeekDate(firstDate); cursor <= addCalendarDays(lastDate, 6); cursor = addCalendarDays(cursor, 7)) {
    const startDate = new Date(cursor);
    const endDate = addCalendarDays(startDate, 6);
    const ownershipDate = addCalendarDays(startDate, 3);
    if (ownershipDate.getFullYear() !== yearNumber || ownershipDate.getMonth() !== monthIndex) continue;
    const week = String(options.length + 1);
    options.push({
      key: `weekly-${year}-${pad2(month)}-${week}`,
      year: String(year),
      month: pad2(month),
      week,
      label: `${Number(month)}월 ${week}주차`,
      weekRange: `${dateToYmd(startDate)} ~ ${dateToYmd(endDate)}`,
      sourceName: '사용자 선택 주차',
    });
  }
  return options;
}

function findWeeklySelection(year, month, week) {
  const y = String(year || WEEKLY_REPORT_LIBRARY[0]?.year || new Date().getFullYear());
  const m = pad2(month || WEEKLY_REPORT_LIBRARY[0]?.month || 1);
  const weekOptions = buildWeeklyWeekOptions(y, m);
  const normalizedWeek = String(week || weekOptions[0]?.week || '1');
  return WEEKLY_REPORT_LIBRARY.find((item) => item.year === y && pad2(item.month) === m && String(item.week) === normalizedWeek)
    || weekOptions.find((item) => item.week === normalizedWeek)
    || weekOptions[0];
}

function resolveWeeklySelection(key) {
  const libraryEntry = WEEKLY_REPORT_LIBRARY.find((item) => item.key === key);
  if (libraryEntry) return libraryEntry;
  const match = String(key || '').match(/^weekly-(\d{4})-(\d{2})-(\d+)$/u);
  if (match) return findWeeklySelection(match[1], match[2], match[3]);
  return WEEKLY_REPORT_LIBRARY[0] || findWeeklySelection(new Date().getFullYear(), new Date().getMonth() + 1, 1);
}

function rawProjectRows(row) {
  return [
    ...(row.detailRows || []).map((item) => [item.label || '-', item.value || '-']),
    ...(row.status ? [['진행 현황', row.status]] : []),
    ...(row.issue ? [['이슈', row.issue]] : []),
    ...(row.plan ? [['계획/운영 메모', row.plan]] : []),
  ];
}

function assetDetailRows(row) {
  return [
    ['자산명', row.assetName || '-'],
    ['펀드명', cleanDisplay(row.fundName)],
    ['연면적', `${formatNumber(row.grossAreaPy)}평`],
    ['준공시점', row.completion || '-'],
    ['투자유형', row.investmentType || '-'],
    ['매입시점', row.acquisition || '-'],
    ['임대차만기', row.leaseMaturity || '-'],
    ['펀드만기', row.fundMaturity || '-'],
    ['대출만기', row.loanMaturity || '-'],
    ['원가', cleanDisplay(row.costPerPy)],
    ['현재대비', cleanDisplay(row.costTrend)],
    ['저온비율', cleanDisplay(row.coldRatio)],
    ['임대율', cleanDisplay(row.occupancyRate)],
    ['주요임차사', cleanDisplay(row.mainTenant)],
    ['Main Issue', cleanDisplay(row.mainIssue)],
  ];
}

function SectionHeader({ eyebrow, title, right }) {
  return (
    <div className="flex items-end justify-between gap-3 mb-3">
      <div>
        <div className="text-[11px] font-semibold text-[#86868B] tracking-[0.02em]">{eyebrow}</div>
        <h2 className="text-[20px] font-semibold text-white tracking-tight mt-1">{title}</h2>
      </div>
      {right}
    </div>
  );
}

function StatusPill({ children, className = '' }) {
  return (
    <span className={`inline-flex items-center h-7 px-3 rounded-[8px] border text-[12px] font-semibold ${className}`}>
      {children}
    </span>
  );
}

function WorklogRow({ item }) {
  return (
    <tr className="border-b border-[#333333] hover:bg-white/[0.035] transition-colors">
      <td className="py-3 pl-4 pr-3 text-[13px] text-[#A1A1AA]">{item.scope}</td>
      <td className="py-3 px-3">
        <div className="text-[14px] text-white font-medium">{item.title}</div>
        <div className="text-[12px] text-[#86868B] mt-1">{item.note}</div>
      </td>
      <td className="py-3 px-3 text-[13px] text-[#E5E5E5]">{item.owner}</td>
      <td className="py-3 px-3">
        <StatusPill className={STATUS_STYLES[item.status] || 'bg-[#262626] text-[#E5E5E5] border-[#3A3A3C]'}>
          {item.status}
        </StatusPill>
      </td>
      <td className="py-3 px-3 text-[13px] text-[#E5E5E5]">{item.priority}</td>
      <td className="py-3 px-3 text-[13px] text-[#A1A1AA]">{item.due}</td>
      <td className="py-3 pr-4 pl-3 text-[13px] text-[#86868B]">{item.asset}</td>
    </tr>
  );
}

function tableHeaderText(header) {
  if (typeof header === 'string' || typeof header === 'number') return String(header);
  return '';
}

function getTableColumnMeta(header, index, total) {
  const label = tableHeaderText(header);
  const compact = /^(No\.?|ID|코드|구분|상태|여부|단계|우선순위|중요도)$/u.test(label);
  const countLike = /^(자산 수|구역 수|행 수|건수)$/u.test(label);
  const dateLike = /날짜|일자|시점|만기|마감|기간|보고일|개시일|종료일/u.test(label);
  const numeric = /수$|건$|개$|율|비율|면적|평|금액|임대료|관리비|임관리비|NOC|원가|차이|합계|잔여|개월|비중/u.test(label);
  const nameLike = /자산명|임차인명|기업명|회사|프로젝트|Task|업무명|펀드명/u.test(label);
  const spaceLike = /층|구역|공간|호실|자산 목록/u.test(label);
  const longText = /내용|이슈|계획|액션|비고|주소|목록|원문|상세|source|Main Issue/u.test(label);
  let width = '140px';
  if (total <= 2) width = index === 0 ? '28%' : '72%';
  else if (label === '임차인명') width = '178px';
  else if (label === '자산 목록') width = '340px';
  else if (countLike) width = '72px';
  else if (compact) width = '76px';
  else if (dateLike) width = '112px';
  else if (numeric) width = '98px';
  else if (nameLike) width = index === 0 ? '240px' : '190px';
  else if (spaceLike) width = '118px';
  else if (longText) width = '240px';
  return { label, compact, countLike, dateLike, numeric, nameLike, spaceLike, longText, width };
}

function normalizeTableColumnWidths(metas) {
  if (metas.length >= 8) return metas;
  const weights = metas.map((meta, index) => {
    if (metas.length <= 2) return index === 0 ? 0.2 : 0.8;
    if (meta.label === '자산 목록') return 2.2;
    if (meta.label === '임차인명') return 1.05;
    if (meta.countLike) return 0.45;
    if (meta.compact) return 0.62;
    if (meta.dateLike) return 0.82;
    if (meta.numeric) return 0.68;
    if (meta.nameLike) return index === 0 ? (metas.length <= 4 ? 1.25 : 1.65) : 1.2;
    if (meta.spaceLike) return 1.3;
    if (meta.longText) return 1.45;
    return 0.78;
  });
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0) || 1;
  return metas.map((meta, index) => ({
    ...meta,
    width: `${((weights[index] / totalWeight) * 100).toFixed(3)}%`,
  }));
}

function renderTableCell(cell, meta) {
  if (cell == null || cell === '') return '-';
  const primitive = typeof cell === 'string' || typeof cell === 'number';
  if (!primitive) return cell;
  const text = String(cell);
  if (meta.numeric || meta.compact || meta.dateLike || meta.nameLike || meta.spaceLike) {
    return <span className="block truncate" title={text}>{text}</span>;
  }
  if (meta.longText || text.length > 34) {
    return <span className="block whitespace-normal break-keep leading-5" title={text}>{text}</span>;
  }
  return <span className="block truncate" title={text}>{text}</span>;
}

function DataTable({ headers, rows, onRowClick, compact = false }) {
  const metas = normalizeTableColumnWidths(headers.map((header, index) => getTableColumnMeta(header, index, headers.length)));
  const minTableWidth = headers.length >= 8
    ? `${Math.max(980, headers.length * 122)}px`
    : undefined;
  return (
    <div className="custom-scrollbar overflow-x-auto rounded-[10px] border border-[#333333]">
      <table className="w-full min-w-full table-fixed border-collapse text-left" style={minTableWidth ? { minWidth: minTableWidth } : undefined}>
        <colgroup>
          {metas.map((meta, index) => <col key={`${tableHeaderText(headers[index])}-${index}`} style={{ width: meta.width }} />)}
        </colgroup>
        <thead className="bg-[#1F1F1E] text-[#86868B] text-[12px]">
          <tr>
            {headers.map((header, index) => (
              <th key={`${tableHeaderText(header)}-${index}`} className={`px-3 py-2 first:pl-4 last:pr-4 font-semibold ${metas[index].numeric ? 'text-right' : 'text-left'} ${metas[index].compact || metas[index].dateLike ? 'whitespace-nowrap' : 'break-keep'}`}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              onClick={() => onRowClick?.(rowIndex)}
              className={`border-b border-[#333333] last:border-b-0 ${onRowClick ? 'cursor-pointer hover:bg-white/[0.04]' : ''}`}
            >
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className={`${compact ? 'py-1.5' : 'py-2.5'} px-3 first:pl-4 last:pr-4 align-top text-[13px] leading-5 text-[#E5E5E5] ${metas[cellIndex]?.numeric ? 'text-right tabular-nums' : 'text-left'} ${metas[cellIndex]?.compact || metas[cellIndex]?.dateLike || metas[cellIndex]?.nameLike || metas[cellIndex]?.spaceLike ? 'whitespace-nowrap' : ''}`}>
                  {renderTableCell(cell, metas[cellIndex] || {})}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PortfolioAssetTable({ rows }) {
  return (
    <div className="overflow-hidden rounded-[10px] border border-[#333333]">
      <table className="w-full table-fixed border-collapse text-left">
        <colgroup>
          <col className="w-[42px]" />
          <col className="w-[34%]" />
          <col className="w-[24%]" />
          <col className="w-[18%]" />
          <col className="w-[12%]" />
          <col className="w-[12%]" />
        </colgroup>
        <thead className="bg-[#1F1F1E] text-[12px] text-[#86868B]">
          <tr>
            {['No.', '자산명', '주소(시군구)', '연면적(평)', '저온창고 비율', 'E. NOC'].map((header) => (
              <th key={header} className="px-2.5 py-2 font-semibold first:pl-3 last:pr-3">{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.no}-${row.assetName}`} className="border-b border-[#333333] last:border-b-0">
              <td className="px-2.5 py-2 text-[12px] text-[#A1A1AA] first:pl-3">{row.no}</td>
              <td className="truncate px-2.5 py-2 text-[12.5px] font-semibold text-[#F5F5F7]" title={row.assetName}>{row.assetName}</td>
              <td className="truncate px-2.5 py-2 text-[12.5px] text-[#D1D1D6]" title={row.address}>{row.address}</td>
              <td className="whitespace-nowrap px-2.5 py-2 text-right text-[12.5px] font-semibold text-[#E5E5E5] last:pr-3">{row.grossFloorAreaPy}</td>
              <td className="whitespace-nowrap px-2.5 py-2 text-right text-[12.5px] text-[#D1D1D6]">{row.coldRatio}</td>
              <td className="whitespace-nowrap px-2.5 py-2 text-right text-[12.5px] font-semibold text-[#E5E5E5] last:pr-3">{row.eNoc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LogisticsModal({ modal, onClose }) {
  if (!modal) return null;
  const sizeClass = modal.size === 'wide'
    ? 'max-w-[min(1760px,96vw)]'
    : modal.size === 'fullscreen'
      ? 'max-w-[min(1880px,98vw)]'
      : 'max-w-[1120px]';
  const bodyHeightClass = modal.size === 'fullscreen' ? 'max-h-[calc(94vh-88px)]' : 'max-h-[calc(88vh-88px)]';
  return (
    <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center px-4 py-5" role="dialog" aria-modal="true">
      <div className={`w-full ${sizeClass} max-h-[94vh] overflow-hidden rounded-[18px] border border-[#3A3A3C] bg-[#252524] shadow-2xl`}>
        <div className="px-6 py-5 border-b border-[#333333] flex items-center justify-between gap-4">
          <div>
            <div className="text-[12px] text-[#86868B] font-semibold">DETAIL</div>
            <h3 className="text-[22px] text-white font-semibold tracking-tight mt-1">{modal.title}</h3>
          </div>
          <button type="button" onClick={onClose} className="h-9 px-3 rounded-[8px] bg-[#1F1F1E] text-[#C7C7CC] text-[13px] font-semibold hover:bg-[#30302F]">닫기</button>
        </div>
        <div className={`custom-scrollbar p-6 overflow-auto ${bodyHeightClass}`}>
          {modal.rows ? (
            <DataTable headers={modal.headers} rows={modal.rows} compact />
          ) : modal.content}
        </div>
      </div>
    </div>
  );
}

function TenantContractFullView({ rows }) {
  const [assetFilter, setAssetFilter] = useState('all');
  const [tenantFilter, setTenantFilter] = useState('all');
  const assetOptions = useMemo(() => [...new Set((rows || []).map((row) => row.assetName).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko-KR')), [rows]);
  const tenantOptions = useMemo(() => [...new Set((rows || []).map((row) => row.tenantMasterName).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko-KR')), [rows]);
  const visibleRows = useMemo(() => (rows || []).filter((row) => (
    (assetFilter === 'all' || row.assetName === assetFilter)
    && (tenantFilter === 'all' || row.tenantMasterName === tenantFilter)
  )), [assetFilter, rows, tenantFilter]);
  const headers = ['임차인명', '자산명', '펀드명', '주소/권역', '층/구역', '계약개시', '계약만기', '잔여개월', '임대면적(평)', '월 임대료', '월 관리비', '월 임관리비', '평당 월 임대료', '평당 월 관리비', '평당 월 임관리비', 'E. NOC', '보증금', '용도', '저온/상온', '계약기간'];
  const bodyRows = visibleRows.map((row) => {
    const expiry = firstDefined(row.currentEndDate, row.latestExpiry, row.earliestExpiry);
    return [
      row.tenantMasterName || '-',
      row.assetName || '-',
      row.fundName || '-',
      [formatSigunguAddress(firstDefined(row.standardizedAddress, row.address)), row.region].filter((value) => cleanDisplay(value, '')).join(' / ') || '-',
      row.spaceLabel || row.floorLabel || row.detailAreaLabel || '-',
      formatDate(row.currentStartDate),
      formatDate(expiry),
      monthsUntil(expiry) == null ? '-' : `${formatNumber(monthsUntil(expiry))}개월`,
      formatArea(row.leasedAreaSqm),
      formatCurrency(firstDefined(row.currentMonthlyRentTotal, row.monthlyRentTotal)),
      formatCurrency(firstDefined(row.currentMonthlyMfTotal, row.monthlyMfTotal)),
      formatCurrency(firstDefined(row.monthlyCostTotal, row.monthlyCombinedTotal)),
      formatWon(firstDefined(row.currentRentPerPy, row.rentPerPy)),
      formatWon(firstDefined(row.currentMfPerPy, row.mfPerPy)),
      formatWon(calculatePerPy(firstDefined(row.monthlyCostTotal, row.monthlyCombinedTotal), row.leasedAreaSqm)),
      formatWon(row.eNoc),
      formatCurrency(firstDefined(row.deposit, row.currentDeposit, row.securityDeposit)),
      cleanDisplay(firstDefined(row.goodsType, row.useType, row.tenantUse), '-'),
      cleanDisplay(firstDefined(row.coldStorageType, row.temperatureType), '-'),
      [formatDate(row.currentStartDate), formatDate(expiry)].filter((value) => value && value !== '-').join(' ~ ') || '-',
    ];
  });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-[12px] leading-5 text-[#A1A1AA]">
          조회 전용입니다. 추가, 수정, 삭제는 Data Quality에서 source row/source cell 기준으로 요청합니다.
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={assetFilter} onChange={(event) => setAssetFilter(event.target.value)} className="h-9 min-w-[220px] rounded-[8px] border border-[#3A3A3C] bg-[#1F1F1E] px-3 text-[12px] text-white">
            <option value="all">자산 전체</option>
            {assetOptions.map((assetName) => <option key={assetName} value={assetName}>{assetName}</option>)}
          </select>
          <select value={tenantFilter} onChange={(event) => setTenantFilter(event.target.value)} className="h-9 min-w-[220px] rounded-[8px] border border-[#3A3A3C] bg-[#1F1F1E] px-3 text-[12px] text-white">
            <option value="all">임차인 전체</option>
            {tenantOptions.map((tenantName) => <option key={tenantName} value={tenantName}>{tenantName}</option>)}
          </select>
        </div>
      </div>
      <div className="custom-scrollbar max-h-[70vh] overflow-auto rounded-[10px] border border-[#333333]">
        <table className="min-w-[2850px] border-collapse text-left text-[12px]">
          <thead className="sticky top-0 z-20 bg-[#1F1F1E] text-[#86868B]">
            <tr>
              {headers.map((header, index) => (
                <th key={header} className={`border-b border-[#333333] px-3 py-2 font-semibold ${index === 0 ? 'sticky left-0 z-30 w-[180px] bg-[#1F1F1E]' : index === 1 ? 'sticky left-[180px] z-30 w-[280px] bg-[#1F1F1E]' : index === 2 ? 'min-w-[240px]' : index === 3 ? 'min-w-[220px]' : 'whitespace-nowrap'}`}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bodyRows.map((row, rowIndex) => (
              <tr key={`${row[0]}-${row[1]}-${row[3]}-${rowIndex}`} className="border-b border-[#333333] last:border-b-0 hover:bg-white/[0.04]">
                {row.map((cell, cellIndex) => (
                  <td key={`${rowIndex}-${cellIndex}`} className={`px-3 py-2 align-top text-[#E5E5E5] ${cellIndex >= 8 && cellIndex <= 16 ? 'text-right tabular-nums' : 'text-left'} ${cellIndex === 0 ? 'sticky left-0 z-10 max-w-[180px] bg-[#252524] font-semibold' : cellIndex === 1 ? 'sticky left-[180px] z-10 max-w-[280px] bg-[#252524] font-semibold' : 'whitespace-nowrap'}`}>
                    <span className={cellIndex <= 4 || cellIndex >= 17 ? 'block max-w-[300px] truncate' : 'block whitespace-nowrap'} title={typeof cell === 'string' ? cell : undefined}>{cell}</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!bodyRows.length ? <div className="p-5 text-[13px] text-[#86868B]">선택 조건에 해당하는 계약이 없습니다.</div> : null}
      </div>
    </div>
  );
}

function ProjectDetail({ project, section, onRaw }) {
  return (
    <article className="rounded-[14px] border border-[#333333] bg-[#1F1F1E] p-4">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <StatusPill className="bg-[#252524] text-[#C7C7CC] border-[#3A3A3C]">{cleanDisplay(project.risk || project.funding, 'Project')}</StatusPill>
          <h4 className="text-[18px] text-white font-semibold mt-3">{project.projectName}</h4>
        </div>
        <button type="button" onClick={onRaw} className="h-9 shrink-0 px-3 rounded-[8px] bg-[#30302F] text-white text-[13px] font-semibold hover:bg-[#3A3A3A]">상세 원문 보기</button>
      </div>
      <DataTable headers={['구분', '내용']} rows={projectSummaryRows(project, section)} compact />
    </article>
  );
}

function WeeklyAssetStatusTable({ title = '자산현황 원문 전체 보기' }) {
  const [modal, setModal] = useState(null);
  const assetRows = useMemo(() => normalizeWeeklyAssetRows(weeklyReportData.assetRows || []), []);
  const fullHeaders = ['자산명', '펀드명', '종류', '연면적(평)', '준공', '투자유형', '매입시점', '임대차만기', '펀드만기', '대출만기', '원가', '현재대비', '저온비율', '임대율', '주요임차사', 'Main Issue'];
  const tableRows = assetRows.map((row) => [
    row.assetName,
    cleanDisplay(row.fundName),
    row.category,
    formatNumber(row.grossAreaPy),
    row.completion,
    row.investmentType,
    row.acquisition,
    row.leaseMaturity || '-',
    row.fundMaturity || '-',
    row.loanMaturity || '-',
    cleanDisplay(row.costPerPy),
    cleanDisplay(row.costTrend),
    cleanDisplay(row.coldRatio),
    cleanDisplay(row.occupancyRate),
    cleanDisplay(row.mainTenant),
    cleanDisplay(row.mainIssue),
  ]);
  const openAssetDetail = (row) => setModal({
    title: `자산현황 상세 · ${row.assetName}`,
    headers: ['항목', '내용'],
    rows: assetDetailRows(row),
  });

  return (
    <section className="mb-[28px] rounded-[24px] border border-[#333333] bg-[#252524] p-5">
      <LogisticsModal modal={modal} onClose={() => setModal(null)} />
      <SectionHeader
        eyebrow="ASSET STATUS"
        title={title}
        right={<span className="text-[12px] font-semibold text-[#86868B]">Weekly 자산현황 원문 기준</span>}
      />
      <DataTable headers={fullHeaders} rows={tableRows} onRowClick={(index) => openAssetDetail(assetRows[index])} compact />
    </section>
  );
}

function WeeklyDashboard() {
  const { memberInfo } = useAuth();
  const [selectedWeekKey, setSelectedWeekKey] = useState(WEEKLY_REPORT_LIBRARY[0]?.key || '');
  const [assetView, setAssetView] = useState('core');
  const initialReport = WEEKLY_REPORT_LIBRARY[0]?.report || weeklyReportData;
  const [selectedNewId, setSelectedNewId] = useState(initialReport.newProjects?.[0]?.id || '');
  const [selectedManagementId, setSelectedManagementId] = useState(initialReport.managementProjects?.[0]?.id || '');
  const [draftAssetRows, setDraftAssetRows] = useState(initialReport.assetRows || []);
  const [modal, setModal] = useState(null);
  const permission = useMemo(() => resolveLogisticsPermission(memberInfo), [memberInfo]);
  const selectedWeeklyEntry = resolveWeeklySelection(selectedWeekKey);
  const report = selectedWeeklyEntry?.report || {
    ...weeklyReportData,
    reportTitle: `${permission.organization} 주간업무보고 · ${selectedWeeklyEntry?.label || '선택 주차'}`,
    reportDate: selectedWeeklyEntry?.weekRange || weeklyReportData.reportDate,
  };
  const assetRows = useMemo(() => normalizeWeeklyAssetRows(draftAssetRows || []), [draftAssetRows]);
  const availableYears = buildWeeklyYearOptions();
  const availableMonths = buildWeeklyMonthOptions();
  const availableWeeks = buildWeeklyWeekOptions(selectedWeeklyEntry?.year, selectedWeeklyEntry?.month);

  const selectedNew = (report.newProjects || []).find((item) => item.id === selectedNewId) || report.newProjects?.[0];
  const selectedManagement = (report.managementProjects || []).find((item) => item.id === selectedManagementId) || report.managementProjects?.[0];
  const totalArea = Number(report.summary?.totalGrossAreaPy || assetRows.reduce((sum, row) => sum + Number(row.grossAreaPy || 0), 0));
  const changeWeeklyEntry = (nextKey) => {
    const nextEntry = resolveWeeklySelection(nextKey);
    const nextReport = nextEntry?.report || weeklyReportData;
    setSelectedWeekKey(nextEntry?.key || '');
    setDraftAssetRows(nextReport.assetRows || []);
    setSelectedNewId(nextReport.newProjects?.[0]?.id || '');
    setSelectedManagementId(nextReport.managementProjects?.[0]?.id || '');
  };

  const openAssetsModal = () => setModal({
    title: '총 자산 수 상세',
    headers: ['자산명', '펀드명', '종류', '연면적(평)', '투자유형', '임대율', 'Main Issue'],
    rows: assetRows.map((row) => [row.assetName, cleanDisplay(row.fundName), row.category, formatNumber(row.grossAreaPy), row.investmentType, cleanDisplay(row.occupancyRate), cleanDisplay(row.mainIssue)]),
  });

  const openAreaModal = () => setModal({
    title: '총 연면적 상세',
    headers: ['자산명', '펀드명', '종류', '연면적(평)', '비중'],
    rows: assetRows
      .slice()
      .sort((a, b) => Number(b.grossAreaPy || 0) - Number(a.grossAreaPy || 0))
      .map((row) => [row.assetName, cleanDisplay(row.fundName), row.category, formatNumber(row.grossAreaPy), totalArea ? formatPercent(Number(row.grossAreaPy || 0) / totalArea) : '-']),
  });

  const openAssetDetail = (row) => setModal({
    title: `주간 업무 자산 상세 · ${row.assetName}`,
    headers: ['항목', '내용'],
    rows: assetDetailRows(row),
  });

  const openProjectRaw = (project) => setModal({
    title: `상세 원문 · ${project.projectName || project.assetName || '-'}`,
    headers: ['항목', '내용'],
    rows: rawProjectRows(project),
  });

  const coreHeaders = ['자산명', '펀드명', '임대율', '주요임차사', 'Main Issue'];
  const fullHeaders = ['자산명', '펀드명', '종류', '연면적(평)', '준공', '투자유형', '매입시점', '임대차만기', '펀드만기', '대출만기', '원가', '현재대비', '저온비율', '임대율', '주요임차사', 'Main Issue'];
  const tableRows = assetRows.map((row) => (
    assetView === 'full'
      ? [row.assetName, cleanDisplay(row.fundName), row.category, formatNumber(row.grossAreaPy), row.completion, row.investmentType, row.acquisition, row.leaseMaturity || '-', row.fundMaturity || '-', row.loanMaturity || '-', cleanDisplay(row.costPerPy), cleanDisplay(row.costTrend), cleanDisplay(row.coldRatio), cleanDisplay(row.occupancyRate), cleanDisplay(row.mainTenant), cleanDisplay(row.mainIssue)]
      : [row.assetName, cleanDisplay(row.fundName), cleanDisplay(row.occupancyRate), cleanDisplay(row.mainTenant), cleanDisplay(row.mainIssue)]
  ));

  return (
    <div className="space-y-6">
      <LogisticsModal modal={modal} onClose={() => setModal(null)} />
      <section className="border border-[#333333] rounded-[20px] bg-[#252524] p-5">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <div className="text-[12px] text-[#86868B] font-semibold">Weekly Operations</div>
            <h3 className="text-[24px] text-white font-semibold tracking-tight mt-1">{report.reportTitle}</h3>
            <p className="mt-2 text-[13px] text-[#A1A1AA]">{permission.organization} · {selectedWeeklyEntry?.weekRange || '주차 범위 확인 필요'}</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <StatusPill className="bg-[#173522] text-[#B5E48C] border-[#2E6B45]">
              조직 기준 열람
            </StatusPill>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <label className="flex h-[100px] flex-col justify-between rounded-[14px] border border-[#333333] bg-[#1F1F1E] px-4 py-3">
            <span className="block text-[12px] font-semibold text-[#86868B]">연도</span>
            <select
              value={selectedWeeklyEntry?.year || ''}
              onChange={(event) => {
                const next = findWeeklySelection(event.target.value, selectedWeeklyEntry?.month, selectedWeeklyEntry?.week);
                changeWeeklyEntry(next.key);
              }}
              className="h-10 w-full rounded-[8px] border border-[#3A3A3C] bg-[#252524] px-3 text-[15px] font-semibold text-white outline-none"
            >
              {availableYears.map((year) => <option key={year} value={year}>{year}년</option>)}
            </select>
          </label>
          <label className="flex h-[100px] flex-col justify-between rounded-[14px] border border-[#333333] bg-[#1F1F1E] px-4 py-3">
            <span className="block text-[12px] font-semibold text-[#86868B]">월</span>
            <select
              value={selectedWeeklyEntry?.month || ''}
              onChange={(event) => {
                const next = findWeeklySelection(selectedWeeklyEntry?.year, event.target.value, selectedWeeklyEntry?.week);
                changeWeeklyEntry(next.key);
              }}
              className="h-10 w-full rounded-[8px] border border-[#3A3A3C] bg-[#252524] px-3 text-[15px] font-semibold text-white outline-none"
            >
              {availableMonths.map((month) => <option key={month} value={month}>{Number(month)}월</option>)}
            </select>
          </label>
          <label className="flex h-[100px] flex-col justify-between rounded-[14px] border border-[#333333] bg-[#1F1F1E] px-4 py-3">
            <span className="block text-[12px] font-semibold text-[#86868B]">주차</span>
            <select
              value={selectedWeeklyEntry?.week || ''}
              onChange={(event) => {
                const next = findWeeklySelection(selectedWeeklyEntry?.year, selectedWeeklyEntry?.month, event.target.value);
                changeWeeklyEntry(next.key);
              }}
              className="h-10 w-full rounded-[8px] border border-[#3A3A3C] bg-[#252524] px-3 text-[15px] font-semibold text-white outline-none"
            >
              {availableWeeks.map((week) => <option key={week.key} value={week.week}>{week.week}주차 · {week.weekRange}</option>)}
            </select>
          </label>
          <div className="flex h-[100px] flex-col justify-between rounded-[14px] border border-[#333333] bg-[#1F1F1E] px-4 py-3">
            <div className="text-[12px] text-[#86868B] font-semibold">보고일</div>
            <div className="truncate text-[18px] font-semibold text-white tabular-nums" title={report.reportDate}>{report.reportDate}</div>
          </div>
          <button type="button" onClick={openAssetsModal} className="flex h-[100px] flex-col justify-between rounded-[14px] border border-[#333333] bg-[#1F1F1E] px-4 py-3 text-left hover:bg-[#2A2A29]">
            <div className="text-[12px] text-[#86868B] font-semibold">총 자산 수</div>
            <div className="text-[18px] font-semibold text-white tabular-nums">{formatNumber(assetRows.length)}개</div>
          </button>
          <button type="button" onClick={openAreaModal} className="flex h-[100px] flex-col justify-between rounded-[14px] border border-[#333333] bg-[#1F1F1E] px-4 py-3 text-left hover:bg-[#2A2A29]">
            <div className="text-[12px] text-[#86868B] font-semibold">총 연면적</div>
            <div className="text-[18px] font-semibold text-white tabular-nums">{formatNumber(totalArea)}평</div>
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
          <SectionHeader
            eyebrow="PROJECTS"
            title="신규 투자 Projects"
            right={(
              <select value={selectedNewId} onChange={(event) => setSelectedNewId(event.target.value)} className="h-9 rounded-[8px] border border-[#3A3A3C] bg-[#1F1F1E] px-3 text-[13px] text-white">
                {(report.newProjects || []).map((item) => <option key={item.id} value={item.id}>{item.projectName}</option>)}
              </select>
            )}
          />
          {selectedNew && <ProjectDetail project={selectedNew} section="newProjects" onRaw={() => openProjectRaw(selectedNew)} />}
        </div>
        <div className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
          <SectionHeader
            eyebrow="PROJECTS"
            title="관리 Projects"
            right={(
              <select value={selectedManagementId} onChange={(event) => setSelectedManagementId(event.target.value)} className="h-9 rounded-[8px] border border-[#3A3A3C] bg-[#1F1F1E] px-3 text-[13px] text-white">
                {(report.managementProjects || []).map((item) => <option key={item.id} value={item.id}>{item.projectName}</option>)}
              </select>
            )}
          />
          {selectedManagement && <ProjectDetail project={selectedManagement} section="managementProjects" onRaw={() => openProjectRaw(selectedManagement)} />}
        </div>
      </section>

      <section className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
        <SectionHeader
          eyebrow="ASSET STATUS"
          title="자산현황"
          right={(
            <div className="flex rounded-[8px] border border-[#3A3A3C] bg-[#1F1F1E] p-1">
              {[
                ['core', '운영 핵심 보기'],
                ['full', '원문 전체 보기'],
              ].map(([value, label]) => (
                <button key={value} type="button" onClick={() => setAssetView(value)} className={`h-8 px-3 rounded-[6px] text-[13px] font-semibold ${assetView === value ? 'bg-white text-[#1F1F1E]' : 'text-[#A1A1AA] hover:text-white'}`}>
                  {label}
                </button>
              ))}
            </div>
          )}
        />
        <DataTable headers={assetView === 'full' ? fullHeaders : coreHeaders} rows={tableRows} onRowClick={(index) => openAssetDetail(assetRows[index])} compact />
      </section>

    </div>
  );
}

void LegacyWorkspaceLogistics;

const MAIN_PRIORITIES = ['높음', '중간', '낮음'];
const PLAYGROUND_MODES = [
  { id: 'sandbox', label: 'Sandbox', title: '샌드박스 결과' },
  { id: 'explorer', label: 'Explorer', title: '탐색 결과' },
  { id: 'workspace', label: 'BI Workspace', title: 'BI 워크스페이스 결과' },
];

const PLAYGROUND_DIMENSIONS = [
  { key: 'assetName', label: '자산' },
  { key: 'fundName', label: '펀드' },
  { key: 'tenantMasterName', label: '임차인' },
  { key: 'sector', label: '섹터' },
  { key: 'region', label: '권역' },
  { key: 'goodsType', label: '물류 유형' },
  { key: 'coldStorageType', label: '저온 유형' },
  { key: 'calculatedReviewStatus', label: '검토 상태' },
];

const PLAYGROUND_METRICS = [
  { key: 'grossFloorAreaSqm', label: '연면적(평)', type: 'area' },
  { key: 'leasedAreaSqm', label: '임대면적(평)', type: 'area' },
  { key: 'vacancyAreaSqm', label: '공실면적(평)', type: 'area' },
  { key: 'currentMonthlyRentTotal', label: '월 임대료', type: 'currency' },
  { key: 'currentMonthlyMfTotal', label: '월 관리비', type: 'currency' },
  { key: 'monthlyCostTotal', label: '월 임관리비', type: 'currency' },
  { key: 'currentRentPerPy', label: '평당 월임대료', type: 'won', aggregate: 'average' },
  { key: 'currentMfPerPy', label: '평당 월관리비', type: 'won', aggregate: 'average' },
  { key: 'eNoc', label: 'E.NOC', type: 'won', aggregate: 'average' },
  { key: 'count', label: '건수', type: 'count' },
];

const ANALYSIS_METRIC_KEYS = ['leasedAreaSqm', 'monthlyCostTotal', 'currentMonthlyRentTotal', 'currentMonthlyMfTotal', 'currentRentPerPy', 'currentMfPerPy', 'eNoc', 'count'];

const PLAYGROUND_AGGREGATIONS = [
  { key: 'sum', label: '합계' },
  { key: 'average', label: '평균' },
  { key: 'count', label: '개수' },
  { key: 'max', label: '최대' },
  { key: 'min', label: '최소' },
];

const PLAYGROUND_SAVED_VIEWS = [
  { key: 'asset-cost', label: '자산별 월 임관리비', dimension: 'assetName', metric: 'monthlyCostTotal', topN: 15 },
  { key: 'tenant-cost', label: '임차인별 월 임관리비', dimension: 'tenantMasterName', metric: 'monthlyCostTotal', topN: 15 },
  { key: 'fund-area', label: '펀드별 임대면적(평)', dimension: 'fundName', metric: 'leasedAreaSqm', topN: 15 },
  { key: 'review-count', label: '검토 상태별 건수', dimension: 'calculatedReviewStatus', metric: 'count', topN: 10 },
];

const WEEKLY_REPORT_LIBRARY = [
  {
    key: '2026-04-w4',
    year: '2026',
    month: '04',
    week: '4',
    weekRange: '2026-04-20 ~ 2026-04-26',
    label: '2026년 4월 4주 · 04.20~04.26',
    sourceName: weeklyReportData.sourceDocumentName || 'RA부문_사업그룹4파트_주간업무자료(안)_260427_취합.docx',
    report: weeklyReportData,
  },
];

const MAIN_STATUS_STYLES = {
  신규: 'bg-[#202C3D] text-[#9AD7FF] border-[#34537A]',
  검토중: 'bg-[#2B2613] text-[#FFD166] border-[#7A6425]',
  진행중: 'bg-[#173522] text-[#B5E48C] border-[#2E6B45]',
  보류: 'bg-[#331F1F] text-[#FF9F9F] border-[#6F3434]',
};

const MAIN_PRIORITY_STYLES = {
  높음: 'text-[#FF453A]',
  중간: 'text-[#2997FF]',
  낮음: 'text-[#8E8E93]',
};

function trimMainText(value, limit = 84) {
  const text = cleanDisplay(value, '-');
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

function inferMainTaskMeta(row, index) {
  const text = `${row.risk || ''} ${row.issue || ''} ${row.status || ''}`;
  const priority = /EOD|경매|Refinancing|미연장|유치권|Lease-up|공실|소송/.test(text)
    ? '높음'
    : index < 3 ? '중간' : '낮음';
  const status = row.plan ? '진행중' : row.issue ? '검토중' : '보류';
  const dueDate = ['2026-05-31', '2026-06-15', '2026-06-30', '2026-07-15', '2026-07-31', '2026-08-15'][index] || '2026-06-30';
  const stakeholder = index === 0 ? '산단공 / 투자자' : index === 1 ? '대주단' : index === 2 ? '법무 / 대주단' : index === 3 ? '시공사 / 임차사' : '섹터 담당자';
  return { priority, status, dueDate, stakeholder };
}

function splitTaskBullets(value) {
  return String(value || '')
    .split(/\n|(?:\s+\/\s+)|(?:\s*\/\s*)/u)
    .map((item) => cleanDisplay(item, ''))
    .filter(Boolean);
}

function normalizeAssetNameKey(value) {
  return String(value || '').replace(/\s+/gu, '').toLowerCase();
}

function assetMatchesPermission(assetName, permission) {
  const key = normalizeAssetNameKey(assetName);
  if (!key) return true;
  return (permission.managedAssets || []).some((asset) => {
    const assetKey = normalizeAssetNameKey(asset.assetName);
    return assetKey && (assetKey.includes(key) || key.includes(assetKey));
  });
}

function assetIdMatchesPermission(assetId, assetName, permission) {
  const readableAssets = permission?.managedAssets || [];
  if (!readableAssets.length) return false;
  const id = String(assetId || '').toLowerCase();
  return readableAssets.some((asset) => (
    (id && String(asset.assetId || '').toLowerCase() === id)
    || (id && String(asset.assetCode || '').toLowerCase() === id)
    || assetMatchesPermission(assetName || asset.assetName, { managedAssets: [asset] })
  ));
}

function filterAssetsByPermission(rows, permission, nameKey = 'assetName', idKey = 'assetId') {
  return (rows || []).filter((row) => assetIdMatchesPermission(row?.[idKey], row?.[nameKey] || row?.label, permission));
}

function logisticsRoleRank(role) {
  const order = ['Reader', 'Editor', 'Manager', 'Admin', 'System Admin'];
  const index = order.indexOf(String(role || 'Reader'));
  return index < 0 ? 0 : index;
}

function hasLogisticsRole(permission, minimum) {
  return logisticsRoleRank(permission?.role || permission?.logisticsRole) >= logisticsRoleRank(minimum);
}

function canViewDataQuality(memberInfo, permission) {
  const name = String(memberInfo?.staff_name || memberInfo?.name || permission?.name || '').trim();
  const organization = String(memberInfo?.organization || memberInfo?.department || permission?.organization || '').trim();
  return organization === '기획추진센터' && DATA_QUALITY_ALLOWED_NAMES.has(name);
}

function canViewAdvancedLogisticsTools(memberInfo, permission) {
  return canViewDataQuality(memberInfo, permission);
}

function taskScopeLabel(scope) {
  if (scope === 'personal') return '개인 업무';
  if (scope === 'team') return '팀 업무';
  return '섹터 업무';
}

function buildMainWeeklyTasks(report, permission) {
  const rows = [...(report.newProjects || []), ...(report.managementProjects || [])];
  return rows.slice(0, 6).map((row, index) => {
    const meta = inferMainTaskMeta(row, index);
    const assetName = cleanDisplay(row.assetName || row.projectName, '');
    const managedAsset = (permission.managedAssets || []).find((asset) => assetMatchesPermission(assetName || asset.assetName, { managedAssets: [asset] }));
    const scope = index % 3 === 0 ? 'personal' : index % 3 === 1 ? 'team' : 'sector';
    return {
      id: row.id || `main-task-${index + 1}`,
      taskName: cleanDisplay(row.projectName || row.assetName, `Weekly Task ${index + 1}`),
      nextAction: trimMainText(row.plan || row.issue || row.status || '후속 액션 확인 필요'),
      issue: trimMainText(row.issue || row.status || '주요 이슈 없음', 108),
      assetName: managedAsset?.assetName || assetName || '-',
      fundName: managedAsset?.fundName || row.fundName || '',
      scope,
      createdByName: permission.name,
      createdByEmail: permission.email,
      organization: permission.organization,
      stakeholder: meta.stakeholder,
      dueDate: meta.dueDate,
      status: meta.status,
      priority: meta.priority,
      completed: false,
      companyName: meta.stakeholder,
      relatedAsset: managedAsset?.assetName || assetName || '-',
      notes: row.status || row.plan || '',
      createdAt: new Date(Date.now() - index * 60000).toISOString(),
      source: 'weekly_report_seed',
    };
  });
}

function sortMainTasks(tasks) {
  return [...(tasks || [])].sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return (Number.isFinite(timeB) ? timeB : 0) - (Number.isFinite(timeA) ? timeA : 0);
  });
}

function filterMainTasksByScope(tasks, scope, permission, showCompleted) {
  return (tasks || []).filter((task) => {
    if (task.status === 'deleted') return false;
    if (!showCompleted && (task.completed || task.status === '완료' || task.status === 'completed')) return false;
    if (scope === 'personal') return task.createdByEmail === permission.email || task.createdByName === permission.name;
    if (scope === 'team') return task.organization && task.organization === permission.organization;
    return assetMatchesPermission(task.assetName, permission);
  });
}

function getLogisticsWeekInfo() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const options = buildWeeklyWeekOptions(year, month);
  const todayTime = new Date(year, month - 1, today.getDate()).getTime();
  const matched = options.find((item) => {
    const [start, end] = item.weekRange.split(' ~ ').map((value) => new Date(value).getTime());
    return todayTime >= start && todayTime <= end;
  }) || options[0];
  return {
    weekLabel: `${String(year).slice(2)}년 ${month}월 ${matched?.week || 1}주`,
    weekId: `logistics-${year}-${month}-${matched?.week || 1}`,
  };
}

function defaultLogisticsTaskDraft(permission, assetName = '') {
  return {
    taskName: '',
    companyName: '',
    assetName: assetName || permission.managedAssets?.[0]?.assetName || '물류센터 워크 플랫폼',
    nextAction: '',
    issue: '',
    notes: '',
    dueDate: new Date().toLocaleDateString('en-CA'),
    priority: '중간',
    status: '신규',
    scope: 'personal',
  };
}

function normalizeLogisticsTaskStatus(status) {
  if (status === 'completed') return '완료';
  if (status === 'new') return '신규';
  return status || '신규';
}

function normalizeServerWorklogTask(row, permission) {
  const payload = row?.payload || {};
  const option = findAssetOption(row?.related_asset_id, payload.assetName || payload.relatedAsset || row?.related_asset_name);
  const taskName = row.task_name || payload.taskName || row.title;
  const nextAction = row.next_action || payload.nextAction || row.body;
  const companyName = row.company_name || payload.companyName || payload.stakeholder || '';
  const assetName = row.related_asset_name || payload.assetName || payload.relatedAsset || option?.assetName;
  return {
    id: row.id,
    taskName: cleanDisplay(taskName, 'Task'),
    nextAction: cleanDisplay(nextAction, ''),
    issue: cleanDisplay(row.issue || payload.issue, ''),
    notes: cleanDisplay(row.notes || payload.notes, ''),
    assetName: cleanDisplay(assetName, '-'),
    relatedAsset: cleanDisplay(assetName, '-'),
    fundName: payload.fundName || option?.fundName || '',
    scope: row.scope || payload.scope || 'personal',
    createdByName: row.created_by_name || payload.createdByName || permission.name,
    createdByEmail: row.created_by_email || payload.createdByEmail || permission.email,
    organization: row.organization || payload.organization || permission.organization,
    stakeholder: companyName || '????',
    companyName,
    dueDate: row.due_date || payload.dueDate || '',
    status: normalizeLogisticsTaskStatus(row.status || payload.status),
    priority: payload.priority || row.priority || '??',
    completed: row.status === 'completed' || Boolean(row.completed_at) || payload.completed,
    createdAt: row.created_at || payload.createdAt || '',
    source: row.task_name ? 'll_work_platform_tasks' : 'll_worklogs',
  };
}

function normalizeIdentity(value) {
  return String(value || '').trim().replace(/\t/g, '').toLowerCase();
}

function resolveLogisticsPermission(memberInfo) {
  const email = normalizeIdentity(memberInfo?.email || memberInfo?.user_email || memberInfo?.login_id || memberInfo?.id);
  const name = String(memberInfo?.staff_name || memberInfo?.name || '').trim();
  const organization = String(memberInfo?.organization || memberInfo?.department || memberInfo?.team_name || '').trim();
  const users = logisticsPermissionData.users || [];
  const matched = users.find((user) => normalizeIdentity(user.email) === email)
    || users.find((user) => name && user.name === name)
    || users.find((user) => organization && user.organization === organization);
  const fallback = {
    name: name || '로그인 사용자',
    email: email || '',
    organization: organization || '조직 미확인',
    managedAssets: [],
    managedFunds: [],
    permissions: {
      managedAsset: { read: true, create: false, update: false, delete: false },
      otherAsset: { read: false, create: false, update: false, delete: false },
    },
  };
  const current = matched || fallback;
  const teamMembers = (logisticsPermissionData.users || []).filter((user) => user.organization && user.organization === current.organization);
  return {
    ...current,
    matched: Boolean(matched),
    teamMembers,
    managedAssets: current.managedAssets || [],
    managedFunds: current.managedFunds || [],
    permissions: current.permissions || fallback.permissions,
  };
}

function permissionText(value) {
  return value ? '허용' : '차단';
}

function PermissionBadge({ label, enabled }) {
  return (
    <span className={`inline-flex h-7 items-center rounded-[8px] border px-2.5 text-[12px] font-semibold ${enabled ? 'border-[#2E6B45] bg-[#173522] text-[#B5E48C]' : 'border-[#4A3434] bg-[#261B1B] text-[#9A8A8A]'}`}>
      {label} {permissionText(enabled)}
    </span>
  );
}

function MainOverlay({ title, eyebrow, onClose, children }) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 px-6 py-8 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="w-full max-w-[960px] max-h-[86vh] overflow-hidden rounded-[18px] border border-[#3A3A3C] bg-[#252524] shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-[#333333] px-6 py-5">
          <div>
            {eyebrow ? <div className="text-[12px] font-semibold text-[#86868B]">{eyebrow}</div> : null}
            <h3 className={`${eyebrow ? 'mt-1' : ''} text-[22px] font-semibold tracking-tight text-white`}>{title}</h3>
          </div>
          <button type="button" onClick={onClose} className="h-9 rounded-[8px] bg-[#1F1F1E] px-3 text-[13px] font-semibold text-[#C7C7CC] hover:bg-[#30302F]">닫기</button>
        </div>
        <div className="custom-scrollbar max-h-[calc(86vh-86px)] overflow-auto p-6">
          {children}
        </div>
      </div>
    </div>
  );
}

function PermissionDetailContent({ permission }) {
  const managedAsset = permission.permissions.managedAsset || {};
  const otherAsset = permission.permissions.otherAsset || {};
  const managedAssetRows = permission.managedAssets.length
    ? permission.managedAssets.map((asset) => [
      asset.assetCode || '-',
      asset.assetName || '-',
      asset.fundCode || '-',
      asset.fundName || '-',
      asset.assetManagerName || '-',
    ])
    : [['-', '현재 로그인 정보와 매칭된 담당 자산이 없습니다.', '-', '-', '-']];
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-[14px] border border-[#333333] bg-[#1F1F1E] p-4">
          <div className="text-[12px] font-semibold text-[#86868B]">사용자</div>
          <div className="mt-2 text-[17px] font-semibold text-white">{permission.name}</div>
          <div className="mt-1 text-[12px] text-[#86868B]">{permission.email || '이메일 미확인'}</div>
        </div>
        <div className="rounded-[14px] border border-[#333333] bg-[#1F1F1E] p-4">
          <div className="text-[12px] font-semibold text-[#86868B]">조직</div>
          <div className="mt-2 text-[17px] font-semibold text-white">{permission.organization}</div>
          <div className="mt-1 text-[12px] text-[#86868B]">팀 구성 {permission.teamMembers.length}명</div>
        </div>
        <div className="rounded-[14px] border border-[#333333] bg-[#1F1F1E] p-4">
          <div className="text-[12px] font-semibold text-[#86868B]">담당 범위</div>
          <div className="mt-2 text-[17px] font-semibold text-white">자산 {permission.managedAssets.length}개</div>
          <div className="mt-1 text-[12px] text-[#86868B]">펀드 {permission.managedFunds.length}개</div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-[14px] border border-[#333333] bg-[#1F1F1E] p-4">
          <div className="mb-3 text-[13px] font-bold text-white">담당 자산 권한</div>
          <div className="flex flex-wrap gap-2">
            <PermissionBadge label="읽기" enabled={managedAsset.read} />
            <PermissionBadge label="추가" enabled={managedAsset.create} />
            <PermissionBadge label="수정" enabled={managedAsset.update} />
            <PermissionBadge label="삭제" enabled={managedAsset.delete} />
          </div>
        </div>
        <div className="rounded-[14px] border border-[#333333] bg-[#1F1F1E] p-4">
          <div className="mb-3 text-[13px] font-bold text-white">기타 자산 권한</div>
          <div className="flex flex-wrap gap-2">
            <PermissionBadge label="읽기" enabled={otherAsset.read} />
            <PermissionBadge label="추가" enabled={otherAsset.create} />
            <PermissionBadge label="수정" enabled={otherAsset.update} />
            <PermissionBadge label="삭제" enabled={otherAsset.delete} />
          </div>
        </div>
      </div>
      <div className="rounded-[14px] border border-[#333333] bg-[#1F1F1E]">
        <div className="border-b border-[#333333] px-4 py-3 text-[13px] font-bold text-white">담당 자산 및 펀드</div>
        <div className="custom-scrollbar max-h-[320px] overflow-auto p-3">
          <DataTable
            headers={['자산코드', '자산명', '펀드코드', '펀드명', '실무 담당자']}
            rows={managedAssetRows}
            compact
          />
        </div>
      </div>
    </div>
  );
}

function normalizeSearchText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[㈜().,·/\\_-]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function buildAssetSearchText(asset) {
  const payload = findAssetPayload(asset.assetId, asset.assetName) || {};
  const overview = payload.overview || {};
  const rows = [
    ...(payload.normalizedRows || []),
    ...(payload.leaseSpaces || []),
    ...(payload.contracts || []),
    ...(payload.monthlyCostByTenant || []),
  ];
  const tenantNames = rows.map((row) => firstDefined(row.tenantMasterName, row.tenantName, row.companyName, row.rawTenantName)).filter(Boolean);
  const rowTextValue = rows.slice(0, 80).map((row) => [
    row.tenantMasterName,
    row.tenantName,
    row.companyName,
    row.assetName,
    row.spaceLabel,
    row.floorLabel,
    row.detailAreaLabel,
    row.coldStorageType,
  ].filter(Boolean).join(' ')).join(' ');
  return [
    asset.assetName,
    asset.assetId,
    asset.assetCode,
    asset.fundName,
    asset.address,
    asset.standardizedAddress,
    overview.assetName,
    overview.fundName,
    overview.standardizedAddress,
    ...tenantNames,
    rowTextValue,
  ].filter(Boolean).join(' ');
}

function buildTenantSearchText(tenant) {
  const payload = COMPANY_PAYLOADS[tenant.tenantId] || {};
  const profile = payload.profile || {};
  const leasedAssets = payload.leasedAssets || payload.leases || [];
  const assetNames = leasedAssets.map((row) => firstDefined(row.assetName, row.asset_name)).filter(Boolean);
  return [
    tenant.tenantMasterName,
    tenant.tenantId,
    tenant.businessRegistrationNo,
    profile.tenantMasterName,
    profile.companyName,
    profile.businessRegistrationNo,
    ...assetNames,
    leasedAssets.slice(0, 80).map((row) => Object.values(row).filter((value) => typeof value !== 'object').join(' ')).join(' '),
  ].filter(Boolean).join(' ');
}

function buildLogisticsSearchResults(query, permission) {
  const text = String(query || '').trim().toLowerCase();
  if (text.length < 2) return [];
  const normalizedQuery = normalizeSearchText(query);
  const terms = normalizedQuery.split(/[^가-힣a-z0-9]+/iu).map((item) => item.trim()).filter((item) => item.length >= 2);
  const matchesQuery = (value) => {
    const haystack = normalizeSearchText(value);
    if (!haystack) return false;
    return haystack.includes(normalizedQuery) || terms.every((term) => haystack.includes(term));
  };
  const managedAssetNames = new Set((permission.managedAssets || []).map((asset) => asset.assetName));
  const assetResults = assetOptionsData
    .filter((asset) => !managedAssetNames.size || managedAssetNames.has(asset.assetName) || assetMatchesPermission(asset.assetName, permission))
    .filter((asset) => matchesQuery(buildAssetSearchText(asset)))
    .sort((a, b) => String(a.assetName || '').localeCompare(String(b.assetName || ''), 'ko-KR'))
    .slice(0, 8)
    .map((asset) => ({
      type: 'asset',
      id: asset.assetId,
      label: asset.assetName,
      subtitle: `월 임관리비 ${formatCurrency(asset.monthlyCostTotal)} · 현재 임차인 ${formatNumber(asset.uniqueTenantCount)}개`,
      raw: asset,
    }));
  const tenantResults = companyOptionsData
    .filter((tenant) => matchesQuery(buildTenantSearchText(tenant)))
    .sort((a, b) => String(a.tenantMasterName || '').localeCompare(String(b.tenantMasterName || ''), 'ko-KR'))
    .slice(0, 8)
    .map((tenant) => ({
      type: 'tenant',
      id: tenant.tenantId,
      label: tenant.tenantMasterName,
      subtitle: `임차 자산 ${formatNumber(tenant.assetCount || tenant.selectorSortMeta?.assetCount)}개 · 월 임관리비 ${formatCurrency(tenant.monthlyCostTotal || tenant.selectorSortMeta?.monthlyCostTotal)}`,
      raw: tenant,
    }));
  return [...assetResults, ...tenantResults].slice(0, 12);
}

function DashboardSearchPreview({ result }) {
  if (!result) return null;
  if (result.type === 'asset') {
    const payload = findAssetPayload(result.id, result.label);
    const asset = normalizeAssetPayload(payload || {});
    const overview = asset.overview || {};
    const rows = asset.normalizedRows || [];
    const tenants = rows.length ? rows.slice(0, 12) : (asset.monthlyCostByTenant || asset.uniqueTenants || []).slice(0, 12);
    const weightedENoc = calculateWeightedENoc(rows, overview.averageENoc);
    const weeklyRow = (weeklyReportData.assetRows || []).find((item) => assetMatchesPermission(overview.assetName || result.label, { managedAssets: [item] })) || {};
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          {[
            ['자산명', overview.assetName || result.label],
            ['펀드명', overview.fundName || result.raw.fundName || '-'],
            ['임대율', formatPercent(overview.vacancyRate == null ? null : 1 - Number(overview.vacancyRate))],
            ['총 임대면적', formatArea(overview.leasedAreaSqm)],
            ['월 임관리비', formatCurrency(overview.monthlyCostTotal || result.raw.monthlyCostTotal)],
            ['E. NOC', formatWon(weightedENoc || overview.averageENoc)],
            ['연면적', formatArea(overview.grossFloorAreaSqm)],
            ['현재 임차인 수', `${formatNumber(overview.uniqueTenantCount || rows.length || result.raw.uniqueTenantCount || 0)}개`],
          ].map(([label, value]) => (
            <div key={label} className="rounded-[12px] border border-[#333333] bg-[#1F1F1E] p-4">
              <div className="text-[12px] font-semibold text-[#86868B]">{label}</div>
              <div className="mt-2 text-[18px] font-semibold text-white">{value}</div>
            </div>
          ))}
        </div>
        <DataTable
          headers={['항목', '내용']}
          rows={[
            ['주소', overview.standardizedAddress || result.raw.address || '-'],
            ['권역', deriveLogisticsRegionFromAddress(overview.standardizedAddress || result.raw.address, '-')],
            ['저온/상온', cleanDisplay(overview.coldStorageMix || result.raw.coldStorageMix, '-')],
            ['Weekly 주요 이슈', cleanDisplay(weeklyRow.mainIssue || overview.mainIssue, '-')],
            ['데이터 기준', cleanDisplay(asset.meta?.sourceName || result.raw.sourceName, 'Supabase ll_* / Excel source snapshot')],
          ]}
          compact
        />
        <DataTable
          headers={['임차인명', '층/구역', '임대면적(평)', '월 임대료', '월 관리비', '월 임관리비', '계약개시', '계약만기', '사업자번호']}
          rows={tenants.map((row) => [
            row.tenantMasterName || '-',
            buildSpaceLabel(row),
            formatArea(row.leasedAreaSqm),
            formatCurrency(firstDefined(row.currentMonthlyRentTotal, row.monthlyRentTotal)),
            formatCurrency(firstDefined(row.currentMonthlyMfTotal, row.monthlyMfTotal)),
            formatCurrency(firstDefined(row.monthlyCostTotal, row.monthlyCombinedTotal)),
            formatDate(row.currentStartDate),
            formatDate(row.currentEndDate || row.latestExpiry),
            formatBusinessRegistrationNo(row.businessRegistrationNo, row.tenantId),
          ])}
          compact
        />
        <div className="flex justify-end">
          <button type="button" onClick={() => navigateToAsset(result.label)} className="h-10 rounded-[8px] bg-white px-4 text-[13px] font-bold text-[#1F1F1E] hover:bg-[#E5E5E5]">Asset 탭에서 전체 보기</button>
        </div>
      </div>
    );
  }

  const payload = COMPANY_PAYLOADS[result.id];
  const company = normalizeCompanyPayload(payload || {});
  const profile = company.profile || {};
  const leasedAssets = company.normalizedLeasedAssets || [];
  const financials = company.financials || {};
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        {[
          ['임차인명', profile.tenantMasterName || result.label],
          ['사업자번호', formatBusinessRegistrationNo(profile.businessRegistrationNo || profile.company?.businessRegistrationNo, result.id)],
          ['임차 자산 수', `${formatNumber(profile.assetCount || result.raw.assetCount)}개`],
          ['총 임차면적', formatArea(profile.leasedAreaSqm)],
          ['월 임관리비', formatCurrency(profile.monthlyCostTotal || result.raw.monthlyCostTotal)],
          ['월 임대료', formatCurrency(profile.monthlyRentTotal || result.raw.monthlyRentTotal)],
          ['월 관리비', formatCurrency(profile.monthlyMfTotal || result.raw.monthlyMfTotal)],
          ['DART 연결', financials.dartLinked ? '연결' : '미연결'],
        ].map(([label, value]) => (
          <div key={label} className="rounded-[12px] border border-[#333333] bg-[#1F1F1E] p-4">
            <div className="text-[12px] font-semibold text-[#86868B]">{label}</div>
            <div className="mt-2 text-[18px] font-semibold text-white">{value}</div>
          </div>
        ))}
      </div>
      <DataTable
        headers={['자산명', '펀드명', '구역', '임대면적(평)', '월 임대료', '월 관리비', '월 임관리비', '평당 임대료', '평당 관리비', '계약개시', '만기']}
        rows={leasedAssets.map((row) => [
          row.assetName || '-',
          row.fundName || '-',
          buildSpaceLabel(row),
          formatArea(row.leasedAreaSqm),
          formatCurrency(row.monthlyRentTotal),
          formatCurrency(row.monthlyMfTotal),
          formatCurrency(row.monthlyCostTotal),
          formatWon(row.currentRentPerPy),
          formatWon(row.currentMfPerPy),
          formatDate(row.currentStartDate),
          formatDate(row.latestExpiry || row.currentEndDate),
        ])}
        compact
      />
      <div className="flex justify-end">
        <button type="button" onClick={() => navigateToCompany(result.id)} className="h-10 rounded-[8px] bg-white px-4 text-[13px] font-bold text-[#1F1F1E] hover:bg-[#E5E5E5]">Company 탭에서 전체 보기</button>
      </div>
    </div>
  );
}

function WeeklyWordUploadPanel({ initialSelection }) {
  const { memberInfo } = useAuth();
  const permission = useMemo(() => resolveLogisticsPermission(memberInfo), [memberInfo]);
  const initialWeek = initialSelection || resolveWeeklySelection(WEEKLY_REPORT_LIBRARY[0]?.key);
  const [selectedWeekKey, setSelectedWeekKey] = useState(initialWeek?.key || '');
  const [file, setFile] = useState(null);
  const [uploadState, setUploadState] = useState({ status: 'idle', message: '' });
  const selectedWeek = resolveWeeklySelection(selectedWeekKey);
  const availableYears = buildWeeklyYearOptions();
  const availableMonths = buildWeeklyMonthOptions();
  const availableWeeks = buildWeeklyWeekOptions(selectedWeek?.year, selectedWeek?.month);
  const selectedWeekRangeLabel = selectedWeek?.weekRange || '';

  function selectWeekBy(partial) {
    const next = findWeeklySelection(
      partial.year || selectedWeek?.year,
      partial.month || selectedWeek?.month,
      partial.week || selectedWeek?.week,
    );
    setSelectedWeekKey(next?.key || '');
  }

  async function handleSubmit() {
    if (!file) {
      setUploadState({ status: 'blocked', message: '업로드할 Word 파일을 먼저 선택해 주세요.' });
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    formData.append('year', selectedWeek?.year || '');
    formData.append('month', selectedWeek?.month || '');
    formData.append('week', selectedWeek?.week || '');
    formData.append('week_range', selectedWeek?.weekRange || '');
    formData.append('week_key', selectedWeek?.key || '');
    formData.append('organization', permission.organization || '');
    formData.append('source_template', `${permission.organization || '조직 미확인'}_주간업무자료`);

    setUploadState({ status: 'loading', message: 'Word 파일을 서버 함수로 전송하는 중입니다.' });
    try {
      const { data, error } = await supabase.functions.invoke('ll-weekly-doc-ingest', { body: formData });
      if (error) throw error;
      setUploadState({
        status: 'success',
        message: data?.message || '서버 반영 요청이 접수되었습니다. Weekly 주차 선택에서 반영 결과를 확인하세요.',
      });
    } catch (error) {
      setUploadState({
        status: 'blocked',
        message: `서버 함수 ll-weekly-doc-ingest 연결이 필요합니다. 현재 화면 계약은 준비됐고, 실제 Supabase 반영은 Edge Function 배포 후 가능합니다. (${error.message || 'unknown error'})`,
      });
    }
  }

  return (
    <section className="mb-4 rounded-[18px] border border-[#333333] bg-[#252524] p-5">
      <h2 className="text-[20px] font-semibold text-white">주간업무보고자료 업로드</h2>
      <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(420px,1fr)_minmax(260px,360px)_auto] xl:items-end">
        <div>
          <label className="mb-2 block text-[14px] font-semibold text-white">반영 기간</label>
          <div className="grid grid-cols-3 gap-2">
            <select value={selectedWeek?.year || ''} onChange={(event) => selectWeekBy({ year: event.target.value })} className="h-10 rounded-[8px] border border-[#3A3A3C] bg-[#1F1F1E] px-3 text-[13px] text-white outline-none">
              {availableYears.map((year) => <option key={year} value={year}>{year}년</option>)}
            </select>
            <select value={selectedWeek?.month || ''} onChange={(event) => selectWeekBy({ month: event.target.value })} className="h-10 rounded-[8px] border border-[#3A3A3C] bg-[#1F1F1E] px-3 text-[13px] text-white outline-none">
              {availableMonths.map((month) => <option key={month} value={month}>{Number(month)}월</option>)}
            </select>
            <select value={selectedWeek?.week || ''} onChange={(event) => selectWeekBy({ week: event.target.value })} className="h-10 rounded-[8px] border border-[#3A3A3C] bg-[#1F1F1E] px-3 text-[13px] text-white outline-none">
              {availableWeeks.map((item) => <option key={item.key} value={item.week}>{item.week}주차</option>)}
            </select>
          </div>
          <div className="mt-2 flex min-h-9 items-center rounded-[8px] border border-[#333333] bg-[#1F1F1E] px-3 text-[13px] font-semibold text-[#D1D1D6]" aria-label="선택한 주차 날짜 범위">
            {selectedWeekRangeLabel || '기간을 선택하세요'}
          </div>
        </div>
        <div>
          <label className="mb-2 block text-[14px] font-semibold text-white">파일 선택</label>
          <input
            type="file"
            accept=".doc,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
            onChange={(event) => setFile(event.target.files?.[0] || null)}
            className="block w-full text-[14px] text-white file:mr-3 file:h-10 file:rounded-[8px] file:border-0 file:bg-[#30302F] file:px-3 file:text-[13px] file:font-semibold file:text-white hover:file:bg-[#3A3A3A]"
          />
        </div>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={uploadState.status === 'loading'}
          className="h-10 min-w-[104px] whitespace-nowrap rounded-[10px] border border-[#2C66A2] bg-[#17314E] px-4 text-[13px] font-semibold text-[#9AD7FF] hover:bg-[#1E3C5F]"
        >
          데이터 반영
        </button>
      </div>
    </section>
  );
}

function MainWorklogRow({ item }) {
  return (
    <tr className="border-b border-[#333333] last:border-b-0 hover:bg-white/[0.035] transition-colors">
      <td className="py-3 pl-4 pr-3 align-top">
        <span className="inline-flex h-8 min-w-[84px] items-center justify-center rounded-[8px] border border-[#333333] bg-[#1F1F1E] px-3 text-[12px] font-semibold text-[#D1D1D6]">
          {item.project}
        </span>
      </td>
      <td className="py-3 px-3 text-[13px] text-[#A1A1AA] align-top whitespace-nowrap">{item.cell}</td>
      <td className="py-3 px-3 align-top">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E8F2FF] text-[12px] font-bold text-[#1F1F1E]">
            {item.owner.slice(0, 1)}
          </span>
          <span className="text-[13px] font-semibold text-white whitespace-nowrap">{item.owner}</span>
        </div>
      </td>
      <td className="py-3 px-3 align-top">
        <div className="text-[14px] text-white font-medium leading-snug break-keep">
          {item.locked && <span className="mr-2 text-[#FF453A]">잠금</span>}{item.title}
        </div>
        <div className="mt-1 text-[12px] text-[#86868B] leading-relaxed break-keep">{item.body}</div>
      </td>
      <td className="py-3 px-3 align-top text-[13px] text-[#A1A1AA] whitespace-nowrap">{item.stakeholder}</td>
      <td className="py-3 px-3 align-top text-[13px] text-[#D1D1D6] whitespace-nowrap">{item.purpose}</td>
      <td className="py-3 px-3 align-top whitespace-nowrap">
        <StatusPill className={MAIN_STATUS_STYLES[item.status] || 'bg-[#262626] text-[#E5E5E5] border-[#3A3A3C]'}>{item.status}</StatusPill>
      </td>
      <td className={`py-3 px-3 align-top text-[13px] font-semibold whitespace-nowrap ${MAIN_PRIORITY_STYLES[item.priority] || 'text-[#D1D1D6]'}`}>{item.priority}</td>
      <td className="py-3 pr-4 pl-3 align-top text-[13px] text-[#86868B] whitespace-nowrap">{item.date}</td>
    </tr>
  );
}

export default function WorkspaceLogistics({ currentPath = '' }) {
  const { user, memberInfo } = useAuth();
  const [taskScope, setTaskScope] = useState('personal');
  const [showAllTasks, setShowAllTasks] = useState(false);
  const [showCompletedTasks, setShowCompletedTasks] = useState(false);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [expandedTaskId, setExpandedTaskId] = useState(null);
  const [mainModal, setMainModal] = useState(null);
  const [mainSearchQuery, setMainSearchQuery] = useState('');
  const [isAiDockOpen, setIsAiDockOpen] = useState(false);
  const [aiChatInput, setAiChatInput] = useState('');
  const [aiChatLoading, setAiChatLoading] = useState(false);
  const [aiDiagnosticsLoading, setAiDiagnosticsLoading] = useState(false);
  const [aiToast, setAiToast] = useState(null);
  const [aiChatMessages, setAiChatMessages] = useState([
    {
      id: 'ai-welcome',
      role: 'assistant',
      content: '물류센터 자산, 임차인, 계약, 이슈에 대해 질문하시면 읽기 권한 범위 안의 데이터로 답변합니다.',
      evidence: [],
    },
  ]);
  const aiChatScrollRef = useRef(null);
  const [selectedSearchResult, setSelectedSearchResult] = useState(null);
  const [taskRecords, setTaskRecords] = useState([]);
  const [taskEditTarget, setTaskEditTarget] = useState(null);
  const [taskDraft, setTaskDraft] = useState(null);
  const [taskServerStatus, setTaskServerStatus] = useState(null);
  const [pendingTaskAction, setPendingTaskAction] = useState(null);

  const isDashboard = currentPath.startsWith(pathFor('dashboard'));
  const requestedModule = currentPath.split('/').pop() || 'home';
  const activeModule = requestedModule === 'sector' || requestedModule === 'weekly' ? 'home' : requestedModule;
  const permission = useMemo(() => resolveLogisticsPermission(memberInfo), [memberInfo]);
  const weeklyTasks = useMemo(() => buildMainWeeklyTasks(weeklyReportData, permission), [permission]);
  const canRegisterTask = Boolean(permission.permissions?.managedAsset?.create || permission.permissions?.managedAsset?.update);
  const canUseAdvancedTools = canViewAdvancedLogisticsTools(memberInfo, permission);

  useEffect(() => {
    if (!canUseAdvancedTools && isAiDockOpen) setIsAiDockOpen(false);
  }, [canUseAdvancedTools, isAiDockOpen]);

  useEffect(() => {
    let cancelled = false;
    const fetchLogisticsTasks = async () => {
      setIsLoadingTasks(true);
      try {
        const { data, error } = await supabase.functions.invoke('ll-dashboard-api', {
          body: { action: 'work-platform/tasks/list', payload: { workspace: 'logistics' } },
        });
        if (error) throw error;
        const rows = Array.isArray(data?.data) ? data.data.map((row) => normalizeServerWorklogTask(row, permission)) : [];
        if (!cancelled) {
          setTaskRecords(rows.length ? rows : weeklyTasks);
          setTaskServerStatus(null);
        }
      } catch {
        if (!cancelled) {
          setTaskRecords(weeklyTasks);
          setTaskServerStatus(null);
        }
      } finally {
        if (!cancelled) setIsLoadingTasks(false);
      }
    };
    fetchLogisticsTasks();
    return () => {
      cancelled = true;
    };
  }, [permission, weeklyTasks]);

  useEffect(() => {
    aiChatScrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [aiChatMessages, aiChatLoading, isAiDockOpen]);

  useEffect(() => {
    if (!aiToast) return undefined;
    const timer = window.setTimeout(() => setAiToast(null), 2200);
    return () => window.clearTimeout(timer);
  }, [aiToast]);

  const scopedTasks = useMemo(() => filterMainTasksByScope(taskRecords, taskScope, permission, showCompletedTasks), [permission, showCompletedTasks, taskRecords, taskScope]);
  const sortedWeeklyTasks = useMemo(() => sortMainTasks(scopedTasks), [scopedTasks]);
  const visibleTasks = showAllTasks ? sortedWeeklyTasks : sortedWeeklyTasks.slice(0, 5);
  const topAssets = useMemo(() => [...(permission.managedAssets || [])].sort((a, b) => String(a.assetName || '').localeCompare(String(b.assetName || ''), 'ko-KR')), [permission.managedAssets]);
  const searchResults = useMemo(() => buildLogisticsSearchResults(mainSearchQuery, permission), [mainSearchQuery, permission]);

  const canModifyTask = (task) => task?.createdByEmail === permission.email || task?.createdByName === permission.name || permission.role === 'Admin' || permission.role === 'Manager';
  const requestTaskAction = (type, task) => {
    if (!canModifyTask(task)) return;
    const messages = {
      edit: '선택한 Task를 수정하시겠습니까?',
      delete: '선택한 Task를 삭제하시겠습니까?',
      complete: '선택한 Task를 완료된 상태로 변경하시겠습니까?',
    };
    setPendingTaskAction({ type, task, message: messages[type] });
  };
  const confirmTaskAction = async () => {
    const action = pendingTaskAction;
    setPendingTaskAction(null);
    if (!action?.task) return;
    if (action.type === 'edit') {
      openTaskEdit(action.task);
      return;
    }
    if (action.type === 'delete') {
      await deleteTask(action.task);
      return;
    }
    if (action.type === 'complete') {
      await completeTask(action.task);
    }
  };
  const submitTaskOperation = async (operation, task, payload = {}) => {
    setTaskServerStatus({ type: 'pending', message: '서버 반영 요청 중입니다.' });
    try {
      const action = operation === 'create' ? 'work-platform/tasks' : `work-platform/tasks/${operation}`;
      const assetName = payload.assetName || task.assetName;
      const { data, error } = await supabase.functions.invoke('ll-dashboard-api', {
        body: {
          action,
          payload: {
            id: task.id,
            scope: payload.scope || task.scope,
            task_name: payload.taskName || task.taskName,
            company_name: payload.companyName || task.companyName || '',
            next_action: payload.nextAction || task.nextAction,
            issue: payload.issue || task.issue || '',
            notes: payload.notes || task.notes || '',
            due_date: payload.dueDate || task.dueDate || null,
            priority: payload.priority || task.priority,
            status: payload.status || task.status,
            related_asset_id: resolveAssetIdByName(assetName),
            related_asset_name: assetName,
            payload: { ...task, ...payload, assetName, relatedAsset: assetName, source: 'main_task_manager' },
          },
        },
      });
      if (error) throw error;
      setTaskServerStatus({ type: 'success', message: data?.message || '서버 반영 요청이 접수됐습니다.' });
    } catch (error) {
      setTaskServerStatus({ type: 'warning', message: `로컬 UI에는 반영했습니다. 실제 DB 저장은 ll-dashboard-api 배포/권한 적용 후 가능합니다. (${error.message || 'unknown error'})` });
    }
  };
  const openTaskEdit = (task) => {
    setTaskEditTarget(task);
    setTaskDraft({
      taskName: task.taskName || '',
      companyName: task.companyName || task.stakeholder || '',
      assetName: task.assetName || topAssets[0]?.assetName || '',
      nextAction: task.nextAction || '',
      issue: task.issue || '',
      notes: task.notes || '',
      dueDate: task.dueDate || '',
      priority: task.priority || '중간',
      status: task.status || '신규',
      scope: task.scope || taskScope,
    });
    setIsAddingTask(true);
    document.getElementById('task-management')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTaskServerStatus(null);
  };
  const startTaskAdd = () => {
    if (!canRegisterTask) {
      setTaskServerStatus({ type: 'warning', message: '현재 권한으로는 Task 등록이 제한됩니다.' });
      return;
    }
    if (isAddingTask) {
      setIsAddingTask(false);
      setTaskEditTarget(null);
      setTaskDraft(null);
      return;
    }
    setTaskDraft(defaultLogisticsTaskDraft(permission, topAssets[0]?.assetName));
    setTaskEditTarget(null);
    setIsAddingTask(true);
  };
  const saveTaskEdit = async () => {
    if (!taskDraft?.taskName) return;
    const now = new Date().toISOString();
    if (taskEditTarget) {
      if (!canModifyTask(taskEditTarget)) return;
      const nextTask = { ...taskEditTarget, ...taskDraft, stakeholder: taskDraft.companyName || '내부업무', relatedAsset: taskDraft.assetName, createdAt: taskEditTarget.createdAt || now };
      setTaskRecords((tasks) => tasks.map((task) => (task.id === taskEditTarget.id ? nextTask : task)));
      await submitTaskOperation('update', taskEditTarget, taskDraft);
    } else {
      const localTask = {
        ...taskDraft,
        id: `local-logistics-task-${Date.now()}`,
        createdAt: now,
        createdByName: permission.name,
        createdByEmail: permission.email,
        organization: permission.organization,
        stakeholder: taskDraft.companyName || '내부업무',
        relatedAsset: taskDraft.assetName,
        completed: false,
        source: 'local_pending',
      };
      setTaskRecords((tasks) => [localTask, ...tasks]);
      await submitTaskOperation('create', localTask, taskDraft);
    }
    setTaskEditTarget(null);
    setTaskDraft(null);
    setIsAddingTask(false);
  };
  const completeTask = async (task) => {
    if (!canModifyTask(task)) return;
    const nextTask = { ...task, completed: true, status: '완료' };
    setTaskRecords((tasks) => tasks.map((item) => (item.id === task.id ? nextTask : item)));
    await submitTaskOperation('complete', task, { status: 'completed', completed: true });
  };
  const deleteTask = async (task) => {
    if (!canModifyTask(task)) return;
    setTaskRecords((tasks) => tasks.filter((item) => item.id !== task.id));
    await submitTaskOperation('delete', task, { status: 'deleted' });
  };
  const describeAiFunctionError = (error, data = null) => {
    const status = data?.provider_status || data?.status || error?.context?.status || error?.status || null;
    const providerError = data?.detail?.provider_error || data?.provider_error || data?.message || '';
    const rawMessage = `${error?.message || ''} ${providerError || ''}`.trim();
    if (/Failed to send a request to the Edge Function/i.test(rawMessage)) {
      return `Edge Function 호출 실패입니다. 배포 URL origin 허용 또는 네트워크/CORS 설정을 먼저 확인해야 합니다. (${rawMessage})`;
    }
    if (status === 401) return 'Edge Function 인증이 거절되었습니다. 로그인 토큰 또는 anon key 설정을 확인해야 합니다.';
    if (status === 403) return 'Edge Function 권한 또는 origin 허용이 거절되었습니다. live preview URL 허용 설정을 확인해야 합니다.';
    if (/spending cap|spend cap|monthly spending/iu.test(rawMessage)) return 'Edge 연결은 정상입니다. 다만 Google AI Studio의 월 지출 한도 설정 때문에 Gemini 응답이 막혀 있습니다.';
    if (status === 429 || /quota|rate limit|exceeded/iu.test(rawMessage)) return 'Gemini 사용량 한도에 걸렸습니다. 내부 DB 근거 답변으로 대체하거나 잠시 뒤 다시 시도해야 합니다.';
    if (/Google AI key is not configured/i.test(rawMessage)) {
      return 'Edge Function secret에 GOOGLE_AI_KEY 또는 GEMINI_API_KEY가 설정되지 않았습니다.';
    }
    if (status >= 500 || /provider request failed/i.test(rawMessage)) {
      return `Gemini provider 호출 실패입니다. GOOGLE_AI_KEY, 모델명, Google 응답 상태를 확인해야 합니다. (${rawMessage || status || 'unknown error'})`;
    }
    return `AI 답변을 불러오지 못했습니다. (${rawMessage || 'unknown error'})`;
  };

  const diagnosticToastMessage = (data) => {
    if (data?.edge_reached) return { type: 'success', message: '연결되었습니다.' };
    return { type: 'warning', message: '연결 진단에 실패했습니다.' };
  };

  const runAiDiagnostics = async () => {
    setAiDiagnosticsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ll-dashboard-api', {
        body: { action: 'ai/provider-diagnostics', payload: { source: 'workspace-chatbot' } },
      });
      if (error) throw error;
      setAiToast(diagnosticToastMessage(data));
    } catch (error) {
      setAiToast({
        type: 'warning',
        message: describeAiFunctionError(error),
      });
    } finally {
      setAiDiagnosticsLoading(false);
    }
  };

  const canUsePreviewAiFallback = () => {
    if (user?.is_demo === true) return true;
    const hostname = window.location.hostname;
    return hostname === 'kylee94.github.io' || hostname === 'localhost' || hostname === '127.0.0.1';
  };

  const submitAiChatQuestion = async () => {
    const question = aiChatInput.trim();
    if (question.length < 2) return;
    const userMessage = {
      id: `ai-user-${Date.now()}`,
      role: 'user',
      content: question,
      evidence: [],
    };
    setAiChatMessages((messages) => [...messages, userMessage]);
    setAiChatInput('');
    setAiChatLoading(true);
    try {
      let responseData = null;
      let primaryError = null;
      try {
        const { data, error } = await supabase.functions.invoke('ll-dashboard-api', {
          body: { action: 'ai/search-chat', payload: { question } },
        });
        responseData = data;
        if (error || !data?.ok) {
          primaryError = error instanceof Error ? error : new Error(data?.message || error?.message || 'AI primary action failed');
          primaryError.data = data;
        }
      } catch (error) {
        primaryError = error;
      }
      if ((primaryError || !responseData?.ok) && canUsePreviewAiFallback()) {
        try {
          const demoResult = await supabase.functions.invoke('ll-dashboard-api', {
            body: { action: 'ai/search-chat-demo', payload: { question } },
          });
          if (demoResult.error) throw demoResult.error;
          responseData = demoResult.data;
        } catch (demoError) {
          throw demoError || primaryError;
        }
      }
      if (primaryError && !responseData?.ok) throw primaryError;
      setAiChatMessages((messages) => [...messages, {
        id: `ai-assistant-${Date.now()}`,
        role: 'assistant',
        content: responseData?.answer || responseData?.message || '권한 범위 안에서 답변할 수 있는 근거를 찾지 못했습니다.',
        evidence: Array.isArray(responseData?.evidence) ? responseData.evidence : [],
        scope: responseData?.scope || null,
        mode: responseData?.mode || null,
        model: responseData?.model || null,
      }]);
    } catch (error) {
      setAiChatMessages((messages) => [...messages, {
        id: `ai-error-${Date.now()}`,
        role: 'assistant',
        tone: 'warning',
        content: describeAiFunctionError(error, error?.data),
        evidence: [],
      }]);
    } finally {
      setAiChatLoading(false);
    }
  };
  const moveTask = async (index, direction) => {
    const visibleList = showAllTasks ? sortedWeeklyTasks : sortedWeeklyTasks.slice(0, 5);
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= visibleList.length) return;
    const current = visibleList[index];
    const other = visibleList[targetIndex];
    const currentCreatedAt = current.createdAt || new Date().toISOString();
    const otherCreatedAt = other.createdAt || new Date(Date.now() - 60000).toISOString();
    setTaskRecords((tasks) => tasks.map((task) => {
      if (task.id === current.id) return { ...task, createdAt: otherCreatedAt };
      if (task.id === other.id) return { ...task, createdAt: currentCreatedAt };
      return task;
    }));
    await submitTaskOperation('update', current, { createdAt: otherCreatedAt });
    await submitTaskOperation('update', other, { createdAt: currentCreatedAt });
  };

  if (isDashboard) {
    return <DashboardShell activeModule={MODULES.some((item) => item.id === activeModule) ? activeModule : 'home'} />;
  }

  return (
    <div className={`w-full max-w-[1200px] px-8 pt-[50px] pb-[70px] transition-[margin,max-width] duration-300 ${isAiDockOpen ? 'xl:ml-8 xl:mr-[420px] xl:max-w-[calc(100vw-760px)]' : 'mx-auto'}`}>
      <header className="mb-[28px] flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="text-[36px] font-bold leading-none tracking-tight text-white font-['Inter']">물류센터 워크 플랫폼</h1>
          <p className="mt-3 text-[15px] leading-6 text-[#86868B]">
            물류센터 관련 업무 현황 및 이슈, 데이터 기반 대시보드
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button type="button" onClick={() => setMainModal('permission')} className={`h-10 rounded-[8px] border px-4 text-[13px] font-bold ${DARK_BUTTON_CLASS}`}>
            담당 및 권한
          </button>
        </div>
      </header>

      <section className="mb-[28px] rounded-[24px] border border-[#333333] bg-[#252524] p-[18px]">
        <div className="grid grid-cols-1 gap-4">
          <div className="flex items-center gap-4">
            <MemberAvatar memberInfo={memberInfo} name={permission.name} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[16px] font-bold text-white">{permission.name}</span>
                <span className="rounded-full border border-[#333333] bg-[#1F1F1E] px-2.5 py-1 text-[12px] font-semibold text-[#A1A1AA]">{permission.organization}</span>
                {!permission.matched && <span className="rounded-full border border-[#4C4329] bg-[#2B2613] px-2.5 py-1 text-[12px] font-semibold text-[#FFD166]">Excel 권한 미매칭</span>}
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-[12px] text-[#86868B]">
                <span>팀 {permission.teamMembers.length}명</span>
                <span>담당 자산 {permission.managedAssets.length}개</span>
                <span>담당 펀드 {permission.managedFunds.length}개</span>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-4 border-t border-[#333333] pt-4">
          <div className="mx-auto grid w-full max-w-[1040px] grid-cols-1 items-center gap-4 md:grid-cols-[128px_minmax(0,1fr)]">
            <h2 className="text-[18px] font-bold text-white md:text-left">통합 검색</h2>
            <input
              data-testid="logistics-main-search-input"
              value={mainSearchQuery}
              onChange={(event) => setMainSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  if (searchResults[0]) setSelectedSearchResult(searchResults[0]);
                }
              }}
              placeholder="자산명 또는 임차인명을 검색하세요"
              className="h-12 w-full rounded-[999px] border border-[#3A3A3C] bg-[#1F1F1E] px-5 text-[15px] font-semibold text-white shadow-inner outline-none placeholder:text-[#6E6E73] focus:border-[#8E8E93]"
            />
          </div>
          {mainSearchQuery.trim().length >= 2 ? (
            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
              {searchResults.length ? searchResults.map((result) => (
                <button
                  key={`${result.type}-${result.id}`}
                  type="button"
                  onClick={() => setSelectedSearchResult(result)}
                  className="cursor-pointer rounded-[12px] border border-[#333333] bg-[#1F1F1E] px-4 py-3 text-left hover:bg-[#2A2A29]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-[14px] font-semibold text-white">{result.label}</span>
                    <span className="shrink-0 rounded-full border border-[#3A3A3C] px-2 py-0.5 text-[11px] font-semibold text-[#A1A1AA]">{result.type === 'asset' ? '자산' : '임차인'}</span>
                  </div>
                  <div className="mt-1 truncate text-[12px] text-[#86868B]">{result.subtitle}</div>
                </button>
              )) : (
                <div className="rounded-[12px] border border-[#333333] bg-[#1F1F1E] p-4 text-[13px] text-[#86868B] md:col-span-2">검색 결과가 없습니다.</div>
              )}
            </div>
          ) : null}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 border-t border-[#333333] pt-4 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-9">
          {topAssets.map((asset) => (
            <button key={asset.assetCode || asset.assetName} type="button" onClick={() => navigateToAsset(asset.assetName)} className="flex min-h-[48px] w-full items-center justify-start rounded-[8px] border border-[#333333] bg-[#1F1F1E] px-2.5 py-2 text-left text-[12px] leading-[15px] text-[#D1D1D6] transition-colors hover:bg-[#2A2A29]">
              <span className="block max-h-[32px] max-w-full overflow-hidden whitespace-normal break-keep text-left font-bold text-white [overflow-wrap:anywhere]" title={asset.assetName}>{asset.assetName}</span>
            </button>
          ))}
        </div>
      </section>

      <WeeklyAssetStatusTable />

      <section className="mb-[28px]">
        <div className="mb-[10px] flex items-center justify-between">
          <div className="flex items-center gap-0">
            <h2 id="task-management" className="flex items-center text-[18px] font-bold tracking-tight text-white">
              <span className="mt-[2px]">물류센터 주요 TASK 관리</span>
              <span className="ml-[10px] rounded-[6px] bg-[#333] px-[8px] py-[3px] text-[14px] font-bold text-[#b3b0a6]">{getLogisticsWeekInfo().weekLabel}</span>
            </h2>
            <a href={`${import.meta.env.BASE_URL}platform/iotaseoul/workspace/archive?workspace=logistics`} target="_blank" rel="opener" className="ml-[10px] mt-[2px] flex cursor-pointer items-center gap-[4px] rounded-[6px] border border-[#3c3c3c] bg-transparent py-[3px] pl-[10px] pr-[8px] text-[13px] font-normal tracking-[-0.02em] text-[#A1A1AA] transition-all hover:bg-[#333] hover:text-white">
              지난 Task 관리
              <svg className="h-[14px] w-[14px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex overflow-hidden rounded-[8px] border border-[#3c3c3c] bg-[#272726] p-[2px]">
              {[
                ['personal', '개인 업무'],
                ['team', '팀 업무'],
                ['sector', '섹터 업무'],
              ].map(([value, label]) => (
                <button key={value} type="button" onClick={() => setTaskScope(value)} className={`rounded-[6px] px-[12px] py-[4px] text-[13px] font-bold transition-colors ${taskScope === value ? 'bg-[#3c3c3c] text-white' : 'text-[#86868B] hover:text-[#E5E5E5]'}`}>{label}</button>
              ))}
            </div>
            <button type="button" onClick={() => setShowCompletedTasks((value) => !value)} className={`rounded-[8px] border px-[12px] py-[6px] text-[13px] font-medium transition-colors ${showCompletedTasks ? 'border-white bg-white text-[#1F1F1E]' : 'border-[#3c3c3c] bg-[#272726] text-[#86868B] hover:bg-[#333] hover:text-[#E5E5E5]'}`}>
              완료 포함
            </button>
            <button type="button" onClick={() => setShowAllTasks((value) => !value)} className="w-[80px] rounded-[8px] border border-[#3c3c3c] bg-[#272726] py-[6px] text-[13px] font-medium text-[#86868B] transition-colors hover:bg-[#333] hover:text-[#E5E5E5]">
              {showAllTasks ? '접기' : '전체보기'}
            </button>
            {!taskEditTarget ? (
              <button type="button" onClick={startTaskAdd} className={`rounded-[8px] border px-[14px] py-[6px] text-[13px] font-bold transition-all ${PRIMARY_BLUE_BUTTON_CLASS}`}>
                {isAddingTask ? '등록 취소' : '+ Task 등록하기'}
              </button>
            ) : null}
          </div>
        </div>
        <div className="-mx-[7px] mb-[34px] rounded-[30px] border border-[#333] p-[6px]">
          <div className="flex w-full flex-col gap-[16px]">
            {isAddingTask && !taskEditTarget && taskDraft ? (
              <div className="flex w-full flex-col gap-4 rounded-[24px] border border-[#3c3c3c] bg-[#272726] p-6">
                <div className="flex gap-4">
                  <input
                    type="text"
                    value={taskDraft.taskName}
                    onChange={(event) => setTaskDraft((draft) => ({ ...draft, taskName: event.target.value }))}
                    className="flex-[2] rounded-[12px] border border-[#444] bg-[#1A1A1A] px-4 py-3 text-[16px] font-bold text-white outline-none focus:border-[#888]"
                    placeholder="Task 입력"
                  />
                  <input
                    type="text"
                    value={taskDraft.companyName}
                    onChange={(event) => setTaskDraft((draft) => ({ ...draft, companyName: event.target.value }))}
                    className="flex-1 rounded-[12px] border border-[#444] bg-[#1A1A1A] px-4 py-3 text-[16px] text-white outline-none focus:border-[#888]"
                    placeholder="이해관계자 검색"
                  />
                </div>
                <input
                  type="text"
                  value={taskDraft.nextAction}
                  onChange={(event) => setTaskDraft((draft) => ({ ...draft, nextAction: event.target.value }))}
                  className="w-full rounded-[12px] border border-[#444] bg-[#1A1A1A] px-4 py-3 text-[15px] text-white outline-none focus:border-[#888]"
                  placeholder="다음 액션 준비사항 입력"
                />
                <textarea
                  value={taskDraft.notes || taskDraft.issue || ''}
                  onChange={(event) => setTaskDraft((draft) => ({ ...draft, notes: event.target.value, issue: event.target.value }))}
                  className="min-h-[92px] w-full resize-y rounded-[12px] border border-[#444] bg-[#1A1A1A] px-4 py-3 text-[14px] text-[#A1A1AA] outline-none focus:border-[#888]"
                  placeholder="상세 내용 입력"
                />
                <div className="flex flex-wrap items-center gap-4">
                  <select
                    value={taskDraft.assetName}
                    onChange={(event) => setTaskDraft((draft) => ({ ...draft, assetName: event.target.value }))}
                    className="cursor-pointer rounded-[10px] border border-[#444] bg-[#1A1A1A] px-3 py-2 text-[14px] text-white outline-none focus:border-[#888]"
                  >
                    {topAssets.map((asset) => <option key={asset.assetCode || asset.assetName} value={asset.assetName}>{asset.assetName}</option>)}
                  </select>
                  <select value={taskDraft.scope} onChange={(event) => setTaskDraft((draft) => ({ ...draft, scope: event.target.value }))} className="rounded-[10px] border border-[#444] bg-[#1A1A1A] px-3 py-2 text-[14px] text-white outline-none focus:border-[#888]">
                    <option value="personal">개인 업무</option>
                    <option value="team">팀 업무</option>
                    <option value="sector">섹터 업무</option>
                  </select>
                  <select value={taskDraft.status} onChange={(event) => setTaskDraft((draft) => ({ ...draft, status: event.target.value }))} className="rounded-[10px] border border-[#444] bg-[#1A1A1A] px-3 py-2 text-[14px] text-white outline-none focus:border-[#888]">
                    {['신규', '검토중', '진행중', '보류', '완료'].map((status) => <option key={status}>{status}</option>)}
                  </select>
                  <select value={taskDraft.priority} onChange={(event) => setTaskDraft((draft) => ({ ...draft, priority: event.target.value }))} className="rounded-[10px] border border-[#444] bg-[#1A1A1A] px-3 py-2 text-[14px] text-white outline-none focus:border-[#888]">
                    {MAIN_PRIORITIES.map((priority) => <option key={priority}>{priority}</option>)}
                  </select>
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 text-[13px] font-bold text-[#86868B]">목표 마감일</span>
                    <input type="date" value={taskDraft.dueDate} onClick={(event) => event.target.showPicker && event.target.showPicker()} onChange={(event) => setTaskDraft((draft) => ({ ...draft, dueDate: event.target.value }))} className="cursor-pointer rounded-[10px] border border-[#444] bg-[#1A1A1A] px-3 py-2 text-[14px] text-[#A1A1AA] outline-none [color-scheme:dark] focus:border-[#888]" />
                  </div>
                  <div className="ml-auto flex gap-2">
                    <button type="button" onClick={() => { setIsAddingTask(false); setTaskEditTarget(null); setTaskDraft(null); }} className="rounded-[10px] border border-[#444] bg-[#3c3c3c]/50 px-5 py-2 text-[14px] font-bold text-[#86868B] transition-colors hover:bg-[#3c3c3c] hover:text-white">취소</button>
                    <button type="button" onClick={saveTaskEdit} className="rounded-[10px] border border-[#059669]/30 bg-[#059669]/20 px-5 py-2 text-[14px] font-bold text-[#34d399] transition-colors hover:bg-[#059669]/40">
                      {taskEditTarget ? '수정 완료' : '저장'}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {isLoadingTasks ? (
              <div className="py-[40px] text-center text-[#86868B]">데이터를 불러오는 중입니다...</div>
            ) : (
              <div className="flex flex-col gap-[8px]">
                <AnimatePresence>
                  {visibleTasks.map((task, index) => (
                    <MotionDiv
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                      key={task.id}
                      id={`task-${task.id}`}
                      onClick={() => setExpandedTaskId((expandedTaskId === 'ALL' || expandedTaskId === task.id) ? null : task.id)}
                      className={`group/row relative w-full cursor-pointer scroll-mt-[100px] rounded-[24px] px-6 pb-[14px] pt-[22px] transition-all duration-300 ${(expandedTaskId === 'ALL' || expandedTaskId === task.id) ? 'border-[2px] border-transparent [background:linear-gradient(#272726,#272726)_padding-box,linear-gradient(to_bottom_right,#d6efe9,#82afb9,#4c6e86)_border-box]' : 'border border-[#3c3c3c] bg-[#272726] hover:bg-[#333]'}`}
                    >
                      {canRegisterTask ? (
                        <div className="absolute bottom-0 left-[-40px] top-0 flex w-[40px] items-center justify-end pr-[8px] opacity-0 transition-opacity group-hover/row:opacity-100">
                          <div className="flex flex-col gap-1">
                            <button type="button" onClick={(event) => { event.stopPropagation(); moveTask(index, 'up'); }} disabled={index === 0} className={`flex h-7 w-7 items-center justify-center rounded-[6px] border border-[#3c3c3c] bg-[#272726] transition-colors ${index === 0 ? 'cursor-not-allowed opacity-30' : 'cursor-pointer hover:bg-[#333]'}`}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#E5E5E5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15" /></svg>
                            </button>
                            <button type="button" onClick={(event) => { event.stopPropagation(); moveTask(index, 'down'); }} disabled={index === visibleTasks.length - 1} className={`flex h-7 w-7 items-center justify-center rounded-[6px] border border-[#3c3c3c] bg-[#272726] transition-colors ${index === visibleTasks.length - 1 ? 'cursor-not-allowed opacity-30' : 'cursor-pointer hover:bg-[#333]'}`}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#E5E5E5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                            </button>
                          </div>
                        </div>
                      ) : null}
                      {canModifyTask(task) ? (
                        <div className="absolute bottom-0 right-[-60px] top-0 flex w-[60px] items-center justify-start pl-[8px] opacity-0 transition-opacity group-hover/row:opacity-100">
                          <div className="flex w-[46px] flex-col gap-1">
                            <button type="button" onClick={(event) => { event.stopPropagation(); requestTaskAction('delete', task); }} className="flex h-[28px] w-full cursor-pointer items-center justify-center rounded-[6px] border border-[#ef4444]/30 bg-[#ef4444]/10 text-[12px] font-bold text-[#ef4444] hover:bg-[#ef4444]/20">삭제</button>
                            <button type="button" onClick={(event) => { event.stopPropagation(); requestTaskAction('edit', task); }} className="flex h-[28px] w-full cursor-pointer items-center justify-center rounded-[6px] border border-[#3b82f6]/30 bg-[#3b82f6]/10 text-[12px] font-bold text-[#3b82f6] hover:bg-[#3b82f6]/20">수정</button>
                            <button type="button" onClick={(event) => { event.stopPropagation(); requestTaskAction('complete', task); }} className="flex h-[28px] w-full cursor-pointer items-center justify-center rounded-[6px] border border-[#059669]/30 bg-[#059669]/10 text-[12px] font-bold text-[#34d399] hover:bg-[#059669]/20">완료</button>
                          </div>
                        </div>
                      ) : null}
                      <div className="flex items-start justify-between gap-8">
                        <div className="flex flex-1 gap-8">
                          <div className="flex w-[430px] shrink-0 flex-col gap-[2px] border-r border-[#444]/50 pr-8">
                            <span className="relative -top-[1px] text-[13px] font-bold text-[#86868B]">Task {index + 1}</span>
                            <h3 className={`text-[21px] font-bold leading-tight tracking-tight ${index < 5 ? 'text-[#e2aa29]' : 'text-white'}`}>
                              {task.taskName}
                            </h3>
                          </div>
                          <div className="flex flex-1 flex-col gap-[2px] pr-4">
                            <div className="mb-1 flex -translate-y-[2px] items-center gap-2">
                              <span className="text-[13px] font-bold text-[#86868B]">다음액션</span>
                              {task.dueDate ? <span className="rounded-full border border-[#3a3a3c] bg-[#2c2c2e] px-[8px] py-[2px] text-[11px] font-medium tracking-tight text-[#A1A1AA]">마감일 목표 {task.dueDate}</span> : null}
                            </div>
                            <div className="-translate-y-[6px] break-keep text-[18px] font-medium leading-relaxed text-[#bbb9af]">
                              {renderBulletListCell(task.nextAction || task.issue || '작성된 내용이 없습니다.')}
                            </div>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          {task.companyName || task.stakeholder ? <span className="text-[13px] font-medium text-[#86868B]">이해관계자</span> : null}
                          <span className={`rounded-[12px] border border-[#333] bg-[#1A1A1A] px-4 py-2 text-[15px] ${task.companyName || task.stakeholder ? 'font-bold text-[#E5E5E5]' : 'font-normal text-[#86868B]'}`}>
                            {task.companyName || task.stakeholder || '내부업무'}
                          </span>
                        </div>
                      </div>

                      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${(expandedTaskId === 'ALL' || expandedTaskId === task.id) ? 'mt-4 max-h-[220px] border-t border-[#3c3c3c] pt-4 opacity-100' : 'max-h-0 opacity-0'}`}>
                        <div className="flex items-center justify-start gap-12">
                          <div className="flex items-center gap-3">
                            <span className="text-[13px] font-bold text-[#86868B]">관련 자산</span>
                            <span className="text-[16px] font-medium text-white">{task.assetName || task.relatedAsset}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-[13px] font-bold text-[#86868B]">업무 구분</span>
                            <span className="text-[16px] font-medium text-white">{taskScopeLabel(task.scope)}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-[13px] font-bold text-[#86868B]">상태</span>
                            <span className={`w-max rounded-[6px] px-2 py-1 text-[13px] font-bold ${task.status === '진행중' ? 'bg-[#059669]/20 text-[#34d399]' : task.status === '검토중' ? 'bg-[#d97706]/20 text-[#fbf167]' : task.status === '완료' ? 'bg-[#2563eb]/20 text-[#60a5fa]' : 'bg-[#4b5563]/20 text-[#9ca3af]'}`}>
                              {task.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-[13px] font-bold text-[#86868B]">중요도</span>
                            <span className={`text-[16px] font-bold ${MAIN_PRIORITY_STYLES[task.priority] || 'text-[#A1A1AA]'}`}>{task.priority}</span>
                          </div>
                        </div>
                        {(task.notes || task.issue) ? (
                          <div className="mt-4 flex items-start gap-4 border-t border-[#3c3c3c]/50 pt-4">
                            <span className="mt-[2px] shrink-0 text-[13px] font-bold text-[#86868B]">비고/링크</span>
                            <span className="break-all text-[14px] font-medium text-white">{renderBulletListCell(task.notes || task.issue)}</span>
                          </div>
                        ) : null}
                      </div>
                      {isAddingTask && taskEditTarget?.id === task.id && taskDraft ? (
                        <div onClick={(event) => event.stopPropagation()} className="mt-4 flex w-full flex-col gap-4 rounded-[18px] border border-[#3c3c3c] bg-[#1F1F1E] p-5">
                          <div className="flex gap-4">
                            <input
                              type="text"
                              value={taskDraft.taskName}
                              onChange={(event) => setTaskDraft((draft) => ({ ...draft, taskName: event.target.value }))}
                              className="flex-[2] rounded-[12px] border border-[#444] bg-[#1A1A1A] px-4 py-3 text-[16px] font-bold text-white outline-none focus:border-[#888]"
                              placeholder="Task 입력"
                            />
                            <input
                              type="text"
                              value={taskDraft.companyName}
                              onChange={(event) => setTaskDraft((draft) => ({ ...draft, companyName: event.target.value }))}
                              className="flex-1 rounded-[12px] border border-[#444] bg-[#1A1A1A] px-4 py-3 text-[16px] text-white outline-none focus:border-[#888]"
                              placeholder="이해관계자 검색"
                            />
                          </div>
                          <input
                            type="text"
                            value={taskDraft.nextAction}
                            onChange={(event) => setTaskDraft((draft) => ({ ...draft, nextAction: event.target.value }))}
                            className="w-full rounded-[12px] border border-[#444] bg-[#1A1A1A] px-4 py-3 text-[15px] text-white outline-none focus:border-[#888]"
                            placeholder="다음액션 준비사항 입력"
                          />
                          <textarea
                            value={taskDraft.notes || taskDraft.issue || ''}
                            onChange={(event) => setTaskDraft((draft) => ({ ...draft, notes: event.target.value, issue: event.target.value }))}
                            className="min-h-[92px] w-full resize-y rounded-[12px] border border-[#444] bg-[#1A1A1A] px-4 py-3 text-[14px] text-[#A1A1AA] outline-none focus:border-[#888]"
                            placeholder="상세 내용 입력"
                          />
                          <div className="flex flex-wrap items-center gap-4">
                            <select
                              value={taskDraft.assetName}
                              onChange={(event) => setTaskDraft((draft) => ({ ...draft, assetName: event.target.value }))}
                              className="cursor-pointer rounded-[10px] border border-[#444] bg-[#1A1A1A] px-3 py-2 text-[14px] text-white outline-none focus:border-[#888]"
                            >
                              {topAssets.map((asset) => <option key={asset.assetCode || asset.assetName} value={asset.assetName}>{asset.assetName}</option>)}
                            </select>
                            <select value={taskDraft.scope} onChange={(event) => setTaskDraft((draft) => ({ ...draft, scope: event.target.value }))} className="rounded-[10px] border border-[#444] bg-[#1A1A1A] px-3 py-2 text-[14px] text-white outline-none focus:border-[#888]">
                              <option value="personal">개인 업무</option>
                              <option value="team">팀 업무</option>
                              <option value="sector">섹터 업무</option>
                            </select>
                            <select value={taskDraft.status} onChange={(event) => setTaskDraft((draft) => ({ ...draft, status: event.target.value }))} className="rounded-[10px] border border-[#444] bg-[#1A1A1A] px-3 py-2 text-[14px] text-white outline-none focus:border-[#888]">
                              {['신규', '검토중', '진행중', '보류', '완료'].map((status) => <option key={status}>{status}</option>)}
                            </select>
                            <select value={taskDraft.priority} onChange={(event) => setTaskDraft((draft) => ({ ...draft, priority: event.target.value }))} className="rounded-[10px] border border-[#444] bg-[#1A1A1A] px-3 py-2 text-[14px] text-white outline-none focus:border-[#888]">
                              {MAIN_PRIORITIES.map((priority) => <option key={priority}>{priority}</option>)}
                            </select>
                            <div className="flex items-center gap-2">
                              <span className="shrink-0 text-[13px] font-bold text-[#86868B]">목표 마감일</span>
                              <input type="date" value={taskDraft.dueDate} onClick={(event) => event.target.showPicker && event.target.showPicker()} onChange={(event) => setTaskDraft((draft) => ({ ...draft, dueDate: event.target.value }))} className="cursor-pointer rounded-[10px] border border-[#444] bg-[#1A1A1A] px-3 py-2 text-[14px] text-[#A1A1AA] outline-none [color-scheme:dark] focus:border-[#888]" />
                            </div>
                            <div className="ml-auto flex gap-2">
                              <button type="button" onClick={() => { setIsAddingTask(false); setTaskEditTarget(null); setTaskDraft(null); }} className="rounded-[10px] border border-[#444] bg-[#3c3c3c]/50 px-5 py-2 text-[14px] font-bold text-[#86868B] transition-colors hover:bg-[#3c3c3c] hover:text-white">취소</button>
                              <button type="button" onClick={saveTaskEdit} className="rounded-[10px] border border-[#059669]/30 bg-[#059669]/20 px-5 py-2 text-[14px] font-bold text-[#34d399] transition-colors hover:bg-[#059669]/40">수정 완료</button>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </MotionDiv>
                  ))}
                </AnimatePresence>
                {!visibleTasks.length ? (
                  <div className="rounded-[18px] border border-[#333333] bg-[#1F1F1E] px-5 py-6 text-[13px] text-[#86868B]">현재 권한 범위에 표시할 Task가 없습니다.</div>
                ) : null}
              </div>
            )}
          </div>
          {taskServerStatus ? (
            <div className={`mx-3 mt-4 rounded-[10px] border px-3 py-2 text-[12px] ${taskServerStatus.type === 'success' ? 'border-[#2E6B45] bg-[#173522] text-[#B5E48C]' : taskServerStatus.type === 'warning' ? 'border-[#7A6425] bg-[#2B2613] text-[#FFD166]' : 'border-[#3A3A3C] bg-[#1F1F1E] text-[#A1A1AA]'}`}>
              {taskServerStatus.message}
            </div>
          ) : null}
        </div>
      </section>

      <WorkspaceActivityLog workspaceCode="WS_LOGISTICS" workspaceLabel="물류센터 워크 플랫폼" assetOptions={topAssets} />

      {mainModal === 'permission' && (
        <MainOverlay title="담당자별 자산·펀드 권한" eyebrow="PERMISSION SCOPE" onClose={() => setMainModal(null)}>
          <PermissionDetailContent permission={permission} />
        </MainOverlay>
      )}
      {selectedSearchResult && (
        <MainOverlay title={`통합 검색 · ${selectedSearchResult.label}`} eyebrow={selectedSearchResult.type === 'asset' ? 'ASSET DASHBOARD PREVIEW' : 'COMPANY DASHBOARD PREVIEW'} onClose={() => setSelectedSearchResult(null)}>
          <DashboardSearchPreview result={selectedSearchResult} />
        </MainOverlay>
      )}
      {pendingTaskAction && (
        <MainOverlay title="Task 처리 확인" eyebrow="TASK CONFIRM" onClose={() => setPendingTaskAction(null)}>
          <div className="space-y-5">
            <div className="rounded-[14px] border border-[#333333] bg-[#1F1F1E] p-5">
              <p className="text-[18px] font-semibold text-white">{pendingTaskAction.message}</p>
              <p className="mt-2 text-[13px] text-[#A1A1AA]">{pendingTaskAction.task?.taskName || '선택한 Task'}</p>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setPendingTaskAction(null)} className="h-10 rounded-[8px] border border-[#3A3A3C] bg-[#1F1F1E] px-4 text-[13px] font-semibold text-[#C7C7CC] hover:bg-[#30302F]">아니오</button>
              <button type="button" onClick={confirmTaskAction} className={`h-10 rounded-[8px] border px-4 text-[13px] font-bold ${PRIMARY_BLUE_BUTTON_CLASS}`}>예</button>
            </div>
          </div>
        </MainOverlay>
      )}
      {aiToast ? (
        <div data-testid="logistics-ai-toast" className={`fixed right-6 top-6 z-[90] rounded-[14px] border px-4 py-3 text-[13px] font-bold shadow-2xl ${aiToast.type === 'success' ? 'border-[#2E6B45] bg-[#173522] text-[#B5E48C]' : 'border-[#7A6425] bg-[#2B2613] text-[#FFD166]'}`}>
          {aiToast.message}
        </div>
      ) : null}
      {canUseAdvancedTools ? (
      <>
      <div className="fixed right-0 top-1/2 z-[70] -translate-y-1/2">
        {!isAiDockOpen ? (
          <button
            type="button"
            data-testid="logistics-ai-dock-open"
            onClick={() => setIsAiDockOpen(true)}
            className="flex h-[112px] w-11 items-center justify-center rounded-l-[16px] border border-r-0 border-[#3b82f6]/40 bg-[#1f3763] text-[13px] font-bold text-[#CFE1FF] shadow-2xl transition-colors hover:bg-[#284B87]"
            aria-label="AI 챗봇 열기"
          >
            <span className="flex flex-col items-center justify-center gap-1 leading-none">
              <span className="tracking-normal">AI</span>
              <span>챗</span>
              <span>봇</span>
            </span>
          </button>
        ) : null}
      </div>
      <div data-testid="logistics-ai-dock" className={`fixed right-0 top-0 z-[80] flex h-screen w-[min(420px,calc(100vw-24px))] transform flex-col border-l border-[#333333] bg-[#1B1B1A] shadow-2xl transition-transform duration-300 ${isAiDockOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex h-[68px] shrink-0 items-center justify-between border-b border-[#333333] px-4">
          <div>
            <div className="text-[15px] font-bold text-white">물류센터 AI 챗봇</div>
            <div className="mt-1 text-[11px] font-semibold text-[#86868B]">읽기 권한 범위 내 데이터 기준</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="logistics-ai-diagnostics"
              onClick={runAiDiagnostics}
              disabled={aiDiagnosticsLoading}
              className={`h-9 rounded-[9px] border px-3 text-[12px] font-bold transition-colors ${aiDiagnosticsLoading ? 'border-[#333333] bg-[#222] text-[#6E6E73]' : DARK_BUTTON_CLASS}`}
            >
              {aiDiagnosticsLoading ? '진단 중' : '연결 진단'}
            </button>
            <button
              type="button"
              onClick={() => setIsAiDockOpen(false)}
              className="h-9 w-9 rounded-[9px] border border-[#333333] bg-[#222] text-[18px] font-bold leading-none text-[#D1D1D6] hover:border-[#555] hover:text-white"
              aria-label="AI 챗봇 닫기"
            >
              ×
            </button>
          </div>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {aiChatMessages.map((message) => {
            const isUserMessage = message.role === 'user';
            return (
              <div key={message.id} className={`flex ${isUserMessage ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[84%] rounded-[18px] px-4 py-3 text-[13px] leading-6 shadow-sm ${isUserMessage ? 'rounded-br-[6px] bg-[#3b82f6] text-white' : message.tone === 'warning' ? 'rounded-bl-[6px] border border-[#7A6425] bg-[#2B2613] text-[#FFE6A1]' : 'rounded-bl-[6px] border border-[#333333] bg-[#262625] text-[#F2F2F7]'}`}>
                  <div className="whitespace-pre-line break-keep">{message.content}</div>
                </div>
              </div>
            );
          })}
          {aiChatLoading ? (
            <div className="flex justify-start">
              <div className="rounded-[18px] rounded-bl-[6px] border border-[#333333] bg-[#262625] px-4 py-3 text-[13px] font-semibold text-[#C7C7CC]">
                답변 생성 중...
              </div>
            </div>
          ) : null}
          <div ref={aiChatScrollRef} />
        </div>
        <form
          className="shrink-0 border-t border-[#333333] p-4"
          onSubmit={(event) => {
            event.preventDefault();
            submitAiChatQuestion();
          }}
        >
          <div className="flex items-end gap-2">
            <textarea
              data-testid="logistics-ai-input"
              value={aiChatInput}
              onChange={(event) => setAiChatInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  submitAiChatQuestion();
                }
              }}
              rows={2}
              placeholder="물류센터 데이터에 대해 질문하세요"
              className="max-h-[120px] min-h-[46px] flex-1 resize-none rounded-[14px] border border-[#3A3A3C] bg-[#111] px-3 py-3 text-[13px] font-semibold leading-5 text-white outline-none placeholder:text-[#6E6E73] focus:border-[#8E8E93]"
            />
            <button
              type="submit"
              data-testid="logistics-ai-submit"
              disabled={aiChatLoading || aiChatInput.trim().length < 2}
              className={`h-[46px] rounded-[14px] border px-4 text-[13px] font-bold transition-colors ${aiChatLoading || aiChatInput.trim().length < 2 ? 'border-[#333333] bg-[#222] text-[#6E6E73]' : PRIMARY_BLUE_BUTTON_CLASS}`}
            >
              전송
            </button>
          </div>
        </form>
      </div>
      </>
      ) : null}
    </div>
  );
}

function chartMetricLabel(key, valueType = 'number') {
  const labels = {
    monthlyCostTotalAdjusted: '월 임관리비 합계',
    monthlyCostTotal: '월 임관리비 합계',
    monthlyRentTotal: '월 임대료',
    monthlyMfTotal: '월 관리비',
    activeAssetCount: '운영 자산 수',
    expiringAreaSqm: '만기 예정 임대면적',
    uniqueTenantCount: '임차인 수',
    monthsToExpiry: '잔여 개월',
    leasedAreaSqm: '임대면적',
    value: valueType === 'currency' ? '월 임관리비 합계' : valueType === 'area' ? '임대면적' : '값',
  };
  return labels[key] || key || '값';
}

function shortChartValue(value, valueType = 'number') {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return '-';
  if (valueType === 'currency') {
    if (Math.abs(numeric) >= 100000000) return `${formatDecimalNumber(numeric / 100000000, 1)}억`;
    if (Math.abs(numeric) >= 10000) return `${formatNumber(Math.round(numeric / 10000))}만`;
    return formatNumber(Math.round(numeric));
  }
  if (valueType === 'area') return `${formatNumber(Math.round(numeric * 0.3025))}평`;
  if (valueType === 'percent') return `${(numeric * 100).toFixed(1)}%`;
  if (valueType === 'count') return `${formatNumber(Math.round(numeric))}개`;
  if (valueType === 'months') return `${formatNumber(Math.round(numeric))}개월`;
  return formatNumber(Math.round(numeric));
}

function chartLabel(row, labelKey = 'label') {
  return cleanDisplay(row?.[labelKey] || row?.month || row?.assetName || row?.tenantMasterName || row?.label, '-');
}

function axisLabelText(value, maxLength = 10) {
  const text = cleanDisplay(value, '-');
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(1, maxLength - 1))}…`;
}

function getTooltipPoint(event, container, tooltipWidth = 270, tooltipHeight = 170) {
  const fallbackRect = container?.getBoundingClientRect?.();
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1440;
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 900;
  const rawX = (event.clientX || fallbackRect?.left || 24) + 18;
  const rawY = (event.clientY || fallbackRect?.top || 24) + 10;
  const maxX = Math.max(12, viewportWidth - tooltipWidth - 12);
  const maxY = Math.max(12, viewportHeight - tooltipHeight - 12);
  return {
    x: Math.min(Math.max(12, rawX), maxX),
    y: Math.min(Math.max(12, rawY), maxY),
  };
}

function niceAxisStep(value) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric) || numeric <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(numeric));
  const normalized = numeric / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

function buildAxisSpec(value, valueType = 'number', tickCount = 5) {
  const numeric = Number(value || 0);
  const safeValue = Number.isFinite(numeric) && numeric > 0 ? numeric : 1;
  const displayValue = valueType === 'area' ? safeValue * 0.3025 : safeValue;
  const step = niceAxisStep(displayValue / Math.max(tickCount - 1, 1));
  const displayMax = Math.max(step, Math.ceil(displayValue / step) * step);
  const axisMax = valueType === 'area' ? displayMax / 0.3025 : displayMax;
  const ticks = Array.from({ length: tickCount }, (_, index) => {
    const displayTick = Math.max(0, displayMax - step * index);
    return valueType === 'area' ? displayTick / 0.3025 : displayTick;
  });
  if (ticks.at(-1) !== 0) ticks[ticks.length - 1] = 0;
  return { max: axisMax, ticks };
}

function polarToCartesian(centerX, centerY, radius, angleDegrees) {
  const angleRadians = (angleDegrees * Math.PI) / 180;
  return {
    x: centerX + radius * Math.cos(angleRadians),
    y: centerY + radius * Math.sin(angleRadians),
  };
}

function describeArcPath(centerX, centerY, radius, startAngle, endAngle) {
  const start = polarToCartesian(centerX, centerY, radius, startAngle);
  const end = polarToCartesian(centerX, centerY, radius, endAngle);
  const largeArcFlag = Math.abs(endAngle - startAngle) > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
}

function RichTrendChart({
  rows,
  valueKey,
  secondaryKey,
  valueType = 'currency',
  labelKey = 'month',
  valueLabel,
  secondaryLabel,
  series,
  leftValueType,
  rightValueType,
  rightAxisColor = '#B5E48C',
  chartHeight = 410,
  chartHeightClass = 'h-[390px]',
  onClick,
  extraTooltipRows,
}) {
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const chartRef = useRef(null);
  const activeSeries = (series || []).length
    ? series
    : [
      { key: valueKey, label: valueLabel || chartMetricLabel(valueKey, valueType), valueType, axis: 'left' },
      ...(secondaryKey ? [{ key: secondaryKey, label: secondaryLabel || chartMetricLabel(secondaryKey, 'number'), valueType: 'number', axis: 'right' }] : []),
    ];
  const leftSeries = activeSeries.filter((item) => item.axis !== 'right');
  const rightSeries = activeSeries.filter((item) => item.axis === 'right');
  const primaryValueType = leftValueType || leftSeries[0]?.valueType || valueType;
  const secondaryValueType = rightValueType || rightSeries[0]?.valueType || 'number';
  const points = (rows || []).filter((row) => activeSeries.some((item) => row?.[item.key] != null));
  if (!points.length) return <div className="text-[13px] text-[#86868B]">표시할 차트 데이터가 없습니다.</div>;
  const width = 1280;
  const height = chartHeight;
  const paddingLeft = 124;
  const paddingRight = rightSeries.length ? 88 : 54;
  const paddingTop = 62;
  const paddingBottom = 100;
  const plotWidth = width - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;
  const leftAxis = buildAxisSpec(Math.max(...points.flatMap((row) => leftSeries.map((item) => Number(row[item.key] || 0))), 1), primaryValueType);
  const rightAxis = buildAxisSpec(Math.max(...points.flatMap((row) => rightSeries.map((item) => Number(row[item.key] || 0))), 1), secondaryValueType, leftAxis.ticks.length);
  const maxValue = leftAxis.max;
  const secondaryMax = rightAxis.max;
  const yTicks = leftAxis.ticks;
  const palette = ['#9AD7FF', '#B5E48C', '#FFD166', '#C7A6FF', '#FF9F8A', '#7DD3FC'];
  const xForIndex = (index) => paddingLeft + (index * plotWidth) / Math.max(points.length - 1, 1);
  const yForValue = (value, axis) => {
    const max = axis === 'right' ? secondaryMax : maxValue;
    return paddingTop + (1 - Number(value || 0) / max) * plotHeight;
  };
  const primaryName = leftSeries.map((item) => item.label || chartMetricLabel(item.key, item.valueType)).join(' / ');
  const secondaryName = rightSeries.map((item) => item.label || chartMetricLabel(item.key, item.valueType)).join(' / ');
  const xLabelStep = Math.max(1, Math.ceil(points.length / 7));
  const shouldRotateXLabels = points.length > 7 || points.some((row) => chartLabel(row, labelKey).length > 7);
  const seriesCoords = activeSeries.map((item, seriesIndex) => ({
    ...item,
    label: item.label || chartMetricLabel(item.key, item.valueType),
    color: item.color || palette[seriesIndex % palette.length],
    chartType: item.chartType || item.type || 'line',
    points: points.map((row, index) => ({
      x: xForIndex(index),
      y: yForValue(row[item.key], item.axis),
      row,
      value: row[item.key],
    })),
  }));
  const barSeries = seriesCoords.filter((item) => item.chartType === 'bar');
  const lineSeries = seriesCoords.filter((item) => item.chartType !== 'bar');
  const barSlotWidth = plotWidth / Math.max(points.length, 1);
  const barWidth = Math.max(10, Math.min(30, barSlotWidth * 0.46));
  const Container = onClick ? 'button' : 'div';
  return (
    <Container ref={chartRef} type={onClick ? 'button' : undefined} onClick={onClick} onMouseLeave={() => setHoveredPoint(null)} className="relative w-full overflow-visible rounded-[14px] border border-[#333333] bg-[#1F1F1E] p-4 text-left hover:bg-[#242423]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="text-[12px] text-[#86868B]">
          X축: 월별 기간 · 왼쪽 Y축: {primaryName}{rightSeries.length ? ` · 오른쪽 Y축: ${secondaryName}` : ''}
        </div>
        <div className="flex flex-wrap items-center gap-4 text-[12px] text-[#D1D1D6]">
          {seriesCoords.map((item) => (
            <span key={item.key}><span className="mr-1 inline-block h-[3px] w-5 align-middle" style={{ backgroundColor: item.color }} />{item.label}</span>
          ))}
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className={`${chartHeightClass} w-full overflow-visible`} role="img" aria-label={`${primaryName} 추이 차트`}>
        <text x={paddingLeft} y="24" fill="#D1D1D6" fontSize="13" fontWeight="700">왼쪽 Y축: {primaryValueType === 'area' ? '면적(평)' : primaryName}</text>
        {rightSeries.length > 0 && <text x={width - paddingRight} y="24" textAnchor="end" fill={rightAxisColor} fontSize="13" fontWeight="700">오른쪽 Y축: {secondaryName}</text>}
        {yTicks.map((tickValue, tickIndex) => {
          const y = yForValue(tickValue, 'left');
          const rightTickValue = rightAxis.ticks[tickIndex] ?? 0;
          return (
            <g key={`${tickValue}-${tickIndex}`}>
              <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="#3C3C40" strokeDasharray="3 5" />
              <text x={paddingLeft - 14} y={y + 5} textAnchor="end" fill="#FFFFFF" fontSize="15" fontWeight="800">{shortChartValue(tickValue, primaryValueType)}</text>
              {rightSeries.length > 0 && <text x={width - paddingRight + 14} y={y + 5} fill={rightAxisColor} fontSize="15" fontWeight="800">{shortChartValue(rightTickValue, secondaryValueType)}</text>}
            </g>
          );
        })}
        <line x1={paddingLeft} y1={paddingTop} x2={paddingLeft} y2={paddingTop + plotHeight} stroke="#77777D" strokeWidth="1.4" />
        <line x1={width - paddingRight} y1={paddingTop} x2={width - paddingRight} y2={paddingTop + plotHeight} stroke={rightSeries.length > 0 ? rightAxisColor : '#4A4A4D'} strokeWidth="1.2" />
        <line x1={paddingLeft} y1={paddingTop + plotHeight} x2={width - paddingRight} y2={paddingTop + plotHeight} stroke="#77777D" strokeWidth="1.4" />
        {barSeries.map((item, barIndex) => (
          <g key={`${item.key}-bars`}>
            {item.points.map((point, index) => {
              const baseline = yForValue(0, item.axis);
              const barX = point.x - (barWidth / 2) + ((barIndex - (barSeries.length - 1) / 2) * (barWidth + 4));
              const barY = Math.min(point.y, baseline);
              const barHeight = Math.max(2, Math.abs(baseline - point.y));
              return (
                <rect
                  key={`${item.key}-bar-${chartLabel(point.row, labelKey)}-${index}`}
                  x={barX}
                  y={barY}
                  width={barWidth}
                  height={barHeight}
                  rx="5"
                  fill={item.color}
                  opacity="0.78"
                />
              );
            })}
          </g>
        ))}
        {lineSeries.map((item) => (
          <polyline
            key={`${item.key}-line`}
            points={item.points.map((point) => `${point.x},${point.y}`).join(' ')}
            fill="none"
            stroke={item.color}
            strokeWidth={item.axis === 'right' ? 2.4 : 3}
            strokeDasharray={item.axis === 'right' ? '6 5' : undefined}
          />
        ))}
        {points.map((row, index) => {
          const label = chartLabel(row, labelKey);
          const showLabel = index % xLabelStep === 0 || index === points.length - 1;
          const displayLabel = axisLabelText(label, shouldRotateXLabels ? 9 : 11);
          const metricRows = seriesCoords.map((item) => ({
            label: item.label,
            value: formatMetric(row[item.key], item.valueType || primaryValueType),
            color: item.color,
          }));
          const extraRows = typeof extraTooltipRows === 'function' ? extraTooltipRows(row) : [];
          const detailRows = [...metricRows, ...(Array.isArray(extraRows) ? extraRows : [])];
          return (
            <g key={`${label}-${index}`} className="group">
              <line x1={xForIndex(index)} y1={paddingTop + plotHeight} x2={xForIndex(index)} y2={paddingTop + plotHeight + 5} stroke="#4A4A4D" />
              {showLabel && (
                <text
                  x={xForIndex(index)}
                  y={height - 48}
                  textAnchor={shouldRotateXLabels ? 'end' : 'middle'}
                  transform={shouldRotateXLabels ? `rotate(-32 ${xForIndex(index)} ${height - 48})` : undefined}
                  fill="#C7C7CC"
                  fontSize="13"
                  fontWeight="700"
                >
                  {displayLabel}
                </text>
              )}
              {lineSeries.map((item) => (
                <circle key={`${item.key}-${label}`} cx={xForIndex(index)} cy={yForValue(row[item.key], item.axis)} r={item.axis === 'right' ? 4 : 4.7} fill={item.color} stroke="#111" strokeWidth="1.2" />
              ))}
              <rect
                className="cursor-pointer opacity-0"
                fill="transparent"
                x={xForIndex(index) - 10}
                y={paddingTop}
                width="20"
                height={plotHeight + 16}
                onMouseEnter={(event) => setHoveredPoint({ label, detailRows, ...getTooltipPoint(event, chartRef.current, 360, 190) })}
                onMouseMove={(event) => setHoveredPoint({ label, detailRows, ...getTooltipPoint(event, chartRef.current, 360, 190) })}
                onFocus={() => setHoveredPoint({ label, detailRows, x: 220, y: 64 })}
                onBlur={() => setHoveredPoint(null)}
                tabIndex={0}
              />
            </g>
          );
        })}
        <text x={paddingLeft} y={height - 14} fill="#86868B" fontSize="11">마우스를 점 위에 올리면 해당 월의 세부 값이 표시됩니다.</text>
      </svg>
      {hoveredPoint && (
        <div data-testid="chart-tooltip" className="pointer-events-none fixed z-50 w-[360px] rounded-[10px] border border-[#4A4A4D] bg-[#101010]/95 px-3 py-2.5 text-[12px] text-white shadow-2xl" style={{ left: hoveredPoint.x, top: hoveredPoint.y }}>
          <div className="mb-2 font-semibold">{hoveredPoint.label}</div>
          <div className="space-y-1">
            {hoveredPoint.detailRows.map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-3 text-[#D1D1D6]">
                <span className="min-w-0 truncate">{item.color ? <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} /> : null}{item.label}</span>
                <span className="shrink-0 max-w-[245px] whitespace-normal break-keep text-right font-semibold text-white" title={typeof item.value === 'string' ? item.value : undefined}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Container>
  );
}

function TrendChart({ rows, valueKey, secondaryKey, valueType = 'currency' }) {
  const points = (rows || []).filter((row) => row?.[valueKey] != null).slice(-18);
  if (!points.length) return <div className="text-[13px] text-[#86868B]">표시할 차트 데이터가 없습니다.</div>;
  const width = 760;
  const height = 210;
  const padding = 34;
  const maxValue = Math.max(...points.map((row) => Number(row[valueKey] || 0)), 1);
  const secondaryMax = Math.max(...points.map((row) => Number(row[secondaryKey] || 0)), 1);
  const yTicks = [1, 0.5, 0];
  const coords = points.map((row, index) => {
    const x = padding + (index * (width - padding * 2)) / Math.max(points.length - 1, 1);
    const y = height - padding - (Number(row[valueKey] || 0) / maxValue) * (height - padding * 2);
    const y2 = height - padding - (Number(row[secondaryKey] || 0) / secondaryMax) * (height - padding * 2);
    return { x, y, y2, row };
  });
  return (
    <div className="rounded-[12px] border border-[#333333] bg-[#1F1F1E] p-3">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[205px]" role="img" aria-label="Home trend chart">
        {yTicks.map((tick) => {
          const y = padding + (1 - tick) * (height - padding * 2);
          return (
            <g key={tick}>
              <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="#2F2F2F" strokeDasharray="3 5" />
              <text x={padding - 8} y={y + 4} textAnchor="end" fill="#86868B" fontSize="11">{formatMetric(maxValue * tick, valueType)}</text>
            </g>
          );
        })}
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#3A3A3C" />
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#3A3A3C" />
        <polyline points={coords.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke="#9AD7FF" strokeWidth="3" />
        <polyline points={coords.map((point) => `${point.x},${point.y2}`).join(' ')} fill="none" stroke="#B5E48C" strokeWidth="2" strokeDasharray="5 5" />
        {coords.map((point) => (
          <circle key={`${point.row.month}-${point.x}`} cx={point.x} cy={point.y} r="3.5" fill="#9AD7FF" />
        ))}
        <text x={padding} y={height - 8} fill="#86868B" fontSize="11">{points[0]?.month || points[0]?.label}</text>
        <text x={width - padding} y={height - 8} textAnchor="end" fill="#86868B" fontSize="11">{points[points.length - 1]?.month || points[points.length - 1]?.label}</text>
      </svg>
      <div className="flex flex-wrap items-center justify-between gap-3 text-[12px] text-[#86868B] mt-2">
        <span>Y축: {valueType === 'currency' ? '금액' : '면적'} · X축: 월</span>
        <span><span className="inline-block w-3 h-[3px] bg-[#9AD7FF] mr-1 align-middle" />주 지표 <span className="inline-block w-3 h-[3px] bg-[#B5E48C] ml-3 mr-1 align-middle" />보조 지표</span>
      </div>
    </div>
  );
}

function loadLeafletSdk() {
  if (typeof window === 'undefined') return Promise.reject(new Error('browser unavailable'));
  if (window.L?.map) return Promise.resolve(window.L);
  if (window.__logisticsLeafletPromise) return window.__logisticsLeafletPromise;
  window.__logisticsLeafletPromise = new Promise((resolve, reject) => {
    if (!document.getElementById('logistics-leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'logistics-leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => (window.L?.map ? resolve(window.L) : reject(new Error('Leaflet SDK unavailable')));
    script.onerror = () => reject(new Error('Leaflet SDK load failed'));
    document.head.appendChild(script);
  }).catch((error) => {
    window.__logisticsLeafletPromise = null;
    throw error;
  });
  return window.__logisticsLeafletPromise;
}

async function getNaverMapsClientId() {
  if (typeof window === 'undefined') return '';
  if (window.__logisticsNaverMapsClientId) return window.__logisticsNaverMapsClientId;
  if (window.__logisticsNaverMapsClientIdPromise) return window.__logisticsNaverMapsClientIdPromise;
  window.__logisticsNaverMapsClientIdPromise = supabase.functions.invoke('ll-dashboard-api', {
    body: { action: 'naver/maps-config', payload: {} },
  })
    .then(({ data, error }) => {
      if (error || !data?.ok || !data?.ncp_key_id) throw new Error(error?.message || data?.message || 'Naver Maps client id unavailable');
      window.__logisticsNaverMapsClientId = data.ncp_key_id;
      return data.ncp_key_id;
    })
    .catch((error) => {
      window.__logisticsNaverMapsClientIdPromise = null;
      throw error;
    });
  return window.__logisticsNaverMapsClientIdPromise;
}

function loadNaverMapsSdk(clientId) {
  if (typeof window === 'undefined') return Promise.reject(new Error('browser unavailable'));
  if (!clientId) return Promise.reject(new Error('Naver Maps client id missing'));
  if (window.naver?.maps?.Map) return Promise.resolve(window.naver);
  if (window.__logisticsNaverMapPromise) return window.__logisticsNaverMapPromise;
  window.__logisticsNaverMapPromise = new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => reject(new Error('Naver Maps SDK timeout')), 5000);
    const resolveWhenReady = () => {
      window.clearTimeout(timeoutId);
      if (window.naver?.maps?.Map) resolve(window.naver);
      else reject(new Error('Naver Maps SDK unavailable'));
    };
    const script = document.createElement('script');
    script.id = 'logistics-naver-map-sdk';
    script.async = true;
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(clientId)}`;
    script.onload = resolveWhenReady;
    script.onerror = () => {
      window.clearTimeout(timeoutId);
      reject(new Error('Naver Maps SDK load failed'));
    };
    document.head.appendChild(script);
  }).catch((error) => {
    window.__logisticsNaverMapPromise = null;
    throw error;
  });
  return window.__logisticsNaverMapPromise;
}

function PortfolioMapSchematic({ points }) {
  const validPoints = (points || []).filter((point) => point.latitude != null && point.longitude != null);
  if (!validPoints.length) return <div className="text-[13px] text-[#86868B]">좌표가 등록된 자산이 없습니다.</div>;
  const minLat = Math.min(...validPoints.map((point) => Number(point.latitude)));
  const maxLat = Math.max(...validPoints.map((point) => Number(point.latitude)));
  const minLng = Math.min(...validPoints.map((point) => Number(point.longitude)));
  const maxLng = Math.max(...validPoints.map((point) => Number(point.longitude)));
  const xFor = (point) => 7 + ((Number(point.longitude) - minLng) / Math.max(maxLng - minLng, 0.0001)) * 86;
  const yFor = (point) => 7 + ((maxLat - Number(point.latitude)) / Math.max(maxLat - minLat, 0.0001)) * 86;
  return (
    <div className="relative min-h-[420px] rounded-[14px] border border-[#333333] bg-[#1F1F1E] overflow-hidden">
      <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'linear-gradient(#3A3A3C 1px, transparent 1px), linear-gradient(90deg, #3A3A3C 1px, transparent 1px)', backgroundSize: '44px 44px' }} />
      {validPoints.map((point, index) => (
        <div
          key={point.assetId || point.assetName}
          className="absolute -translate-x-1/2 -translate-y-1/2 group"
          style={{ left: `${xFor(point)}%`, top: `${yFor(point)}%` }}
        >
          <div className="h-8 w-8 rounded-full bg-[#9AD7FF] text-[#111] text-[12px] font-bold flex items-center justify-center shadow-lg shadow-black/30">{index + 1}</div>
          <div className="absolute left-8 top-1/2 -translate-y-1/2 hidden group-hover:block w-[220px] rounded-[8px] border border-[#3A3A3C] bg-[#252524] p-3 text-[12px] text-[#C7C7CC] z-10">
            <strong className="block text-white mb-1">{point.assetName}</strong>
            {point.address || '-'}
          </div>
        </div>
      ))}
    </div>
  );
}

function PortfolioMapPlot({ points }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const validPoints = useMemo(() => (points || []).filter((point) => point.latitude != null && point.longitude != null), [points]);
  const [mode, setMode] = useState('loading');
  const [status, setStatus] = useState('동적 지도를 준비하고 있습니다.');

  useEffect(() => {
    let disposed = false;
    if (!validPoints.length) {
      return undefined;
    }

    const mountLeaflet = () => loadLeafletSdk()
      .then((L) => {
        if (disposed || !containerRef.current) return;
        setMode('leaflet');
        setStatus(`동적 지도 · ${validPoints.length}개 자산`);
        if (mapRef.current) {
          if (typeof mapRef.current.destroy === 'function') mapRef.current.destroy();
          if (typeof mapRef.current.remove === 'function') mapRef.current.remove();
          mapRef.current = null;
        }
        const latLngs = validPoints.map((point) => [Number(point.latitude), Number(point.longitude)]);
        const map = L.map(containerRef.current, {
          scrollWheelZoom: true,
          zoomControl: true,
          attributionControl: true,
        });
        mapRef.current = map;
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors',
        }).addTo(map);
        validPoints.forEach((point, index) => {
          const marker = L.marker([Number(point.latitude), Number(point.longitude)], { title: point.assetName || `자산 ${index + 1}` }).addTo(map);
          marker.bindPopup(`<strong>${point.assetName || `자산 ${index + 1}`}</strong><br>${point.address || ''}`);
        });
        if (latLngs.length > 1) map.fitBounds(latLngs, { padding: [28, 28] });
        else map.setView(latLngs[0], 13);
        [80, 300, 800].forEach((delay) => window.setTimeout(() => {
          if (!disposed && mapRef.current) mapRef.current.invalidateSize();
        }, delay));
      })
      .catch(() => {
        if (disposed) return;
        setMode('schematic');
        setStatus(`스케매틱 지도 대체 · ${validPoints.length}개 자산`);
      });

    getNaverMapsClientId()
      .then((clientId) => loadNaverMapsSdk(clientId))
      .then((naver) => {
        if (disposed || !containerRef.current) return;
        setMode('naver');
        setStatus(`네이버 동적 지도 · ${validPoints.length}개 자산`);
        const latLngs = validPoints.map((point) => new naver.maps.LatLng(Number(point.latitude), Number(point.longitude)));
        const map = new naver.maps.Map(containerRef.current, {
          center: latLngs[0],
          zoom: validPoints.length === 1 ? 13 : 8,
        });
        mapRef.current = map;
        const bounds = new naver.maps.LatLngBounds();
        validPoints.forEach((point, index) => {
          const position = latLngs[index];
          bounds.extend(position);
          const marker = new naver.maps.Marker({
            position,
            map,
            title: point.assetName || `자산 ${index + 1}`,
          });
          const infoWindow = new naver.maps.InfoWindow({
            content: `<div style="padding:10px 12px;font-size:12px;line-height:1.4;"><strong>${point.assetName || `자산 ${index + 1}`}</strong><br>${point.address || ''}</div>`,
          });
          naver.maps.Event.addListener(marker, 'click', () => {
            if (infoWindow.getMap()) infoWindow.close();
            else infoWindow.open(map, marker);
          });
        });
        if (validPoints.length > 1) map.fitBounds(bounds);
        [80, 300, 800].forEach((delay) => window.setTimeout(() => {
          if (!disposed && mapRef.current && naver.maps?.Event) {
            naver.maps.Event.trigger(mapRef.current, 'resize');
            mapRef.current.setCenter(validPoints.length > 1 ? bounds.getCenter() : latLngs[0]);
          }
        }, delay));
        const authCheckStartedAt = Date.now();
        const authFailureInterval = window.setInterval(() => {
          if (disposed || !containerRef.current) return;
          const mapText = containerRef.current.textContent || '';
          const hasAuthFailure = /인증.*실패|Open API 인증|unauthorized|authentication/i.test(mapText);
          const loadedTileCount = containerRef.current.querySelectorAll('img').length;
          if (!hasAuthFailure && Date.now() - authCheckStartedAt < 2500) return;
          if (!hasAuthFailure && loadedTileCount > 1) return;
          window.clearInterval(authFailureInterval);
          try {
            if (mapRef.current && typeof mapRef.current.destroy === 'function') mapRef.current.destroy();
          } catch {
            // Naver SDK can throw while tearing down an unauthorized map shell.
          }
          mapRef.current = null;
          containerRef.current.innerHTML = '';
          mountLeaflet();
        }, 500);
        window.setTimeout(() => window.clearInterval(authFailureInterval), 10000);
      })
      .catch(() => {
        if (!disposed) mountLeaflet();
      });

    return () => {
      disposed = true;
      if (mapRef.current) {
        try {
          if (typeof mapRef.current.destroy === 'function') mapRef.current.destroy();
          if (typeof mapRef.current.remove === 'function') mapRef.current.remove();
        } catch {
          // External map SDK cleanup should not break route changes.
        }
        mapRef.current = null;
      }
    };
  }, [validPoints]);

  if (!validPoints.length) {
    return <div className="text-[13px] text-[#86868B]">좌표가 등록된 자산이 없습니다.</div>;
  }

  return (
    <div className="space-y-3">
      <div className="relative rounded-[14px] border border-[#333333] bg-[#1F1F1E] overflow-hidden" style={{ height: 520 }}>
        <div ref={containerRef} className="logistics-map-canvas [&_img]:!max-w-none [&_*]:box-content" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} aria-label="동적 지도" />
        {mode !== 'leaflet' && mode !== 'naver' ? <PortfolioMapSchematic points={validPoints} /> : null}
        <div className={`absolute left-3 top-3 rounded-full border px-3 py-1 text-[12px] font-semibold ${mode === 'leaflet' || mode === 'naver' ? 'border-[#2E6B45] bg-[#173522] text-[#B5E48C]' : 'border-[#7A6425] bg-[#2B2613] text-[#FFD166]'}`}>
          {status}
        </div>
      </div>
    </div>
  );
}

function normalizeHomeData(home) {
  const kpiMap = Object.fromEntries((home.kpis || []).map((item) => [item.key, item]));
  const occupancy = home.occupancy || {};
  const topContracts = (home.topContracts || []).map((row) => ({
    ...row,
    tenantMasterName: firstDefined(row.tenantMasterName, row.tenantName, row.companyName, '-'),
    leasedAreaSqm: firstDefined(row.leasedAreaSqm, row.currentLeasedAreaSqm, row.totalLeasedAreaSqm),
    monthlyRentTotal: firstDefined(row.monthlyRentTotal, row.currentMonthlyRentTotal),
    monthlyMfTotal: firstDefined(row.monthlyMfTotal, row.currentMonthlyMfTotal),
    monthlyCombinedTotal: firstDefined(row.monthlyTotal, row.monthlyCombinedTotal, row.monthlyCostTotal),
    currentEndDate: firstDefined(row.currentEndDate, row.latestExpiry, row.endDate),
    assetNames: Array.isArray(row.assetNames) ? row.assetNames : [],
  }));
  const topTenants = (home.topTenants || []).map((row) => ({
    ...row,
    tenantMasterName: firstDefined(row.tenantMasterName, row.tenantName, row.companyName, '-'),
    monthlyCombinedTotal: firstDefined(row.monthlyCostTotal, row.monthlyTotal, row.monthlyCombinedTotal),
  }));
  const vacancyRows = home.vacancySummary || [];
  const mapPoints = home.mapPoints || [];
  const monthlyExpiryRows = home.contractSummary?.monthlyExpirySeries || home.contractSummary?.monthlyVacancy || [];
  const upcomingExpiryRows = home.contractSummary?.upcoming || [];
  return {
    kpiMap,
    occupancy,
    topContracts,
    topTenants,
    vacancyRows,
    mapPoints,
    monthlyExpiryRows,
    upcomingExpiryRows,
    operatingAssetCount: firstDefined(kpiMap.operating_asset_count?.value, kpiMap.asset_count?.value, mapPoints.length),
    leasedArea: firstDefined(kpiMap.leased_area_total?.value, occupancy.leasedAreaSqm),
    vacancyArea: firstDefined(kpiMap.vacancy_area_total?.value, occupancy.vacancyAreaSqm),
    vacancyRate: firstDefined(kpiMap.vacancy_rate?.value, occupancy.vacancyRate),
    monthlyCost: firstDefined(kpiMap.monthly_total_cost?.value, sumRows(topContracts, (row) => row.monthlyCombinedTotal)),
  };
}

function HomeDashboard() {
  const { memberInfo } = useAuth();
  const home = homeData;
  const data = useMemo(() => normalizeHomeData(home), [home]);
  const permission = useMemo(() => resolveLogisticsPermission(memberInfo), [memberInfo]);
  const [modal, setModal] = useState(null);
  const [costCompositionMode, setCostCompositionMode] = useState('asset');
  const [compositionAssetId, setCompositionAssetId] = useState('all');
  const [sectorAssetSort, setSectorAssetSort] = useState('cost');
  const [sectorTenantSort, setSectorTenantSort] = useState('cost');
  const [regionMetric, setRegionMetric] = useState('cost');
  const allGeneralRows = useMemo(() => buildLogisticsGeneralRows(), []);
  const generalRows = useMemo(() => filterAssetsByPermission(allGeneralRows, permission), [allGeneralRows, permission]);
  const readableAssetOptions = useMemo(() => filterAssetsByPermission(assetOptionsData, permission), [permission]);
  const readableVacancyRows = useMemo(() => filterAssetsByPermission(data.vacancyRows, permission), [data.vacancyRows, permission]);
  const readableMapPoints = useMemo(() => filterAssetsByPermission(data.mapPoints, permission), [data.mapPoints, permission]);
  const assetSnapshotMonthlyCost = sumRows(readableAssetOptions, (row) => row.monthlyCostTotal);
  const leaseSpaceMonthlyCost = sumRows(generalRows, (row) => row.monthlyCostTotal);
  const canonicalMonthlyCost = Number(assetSnapshotMonthlyCost || data.monthlyCost || leaseSpaceMonthlyCost || 0);
  const rawRentTrendRows = home.rentTrend || [];

  const rentTrendRows = rawRentTrendRows.map((row, index) => {
    const isLatest = index === rawRentTrendRows.length - 1;
    const originalCost = firstDefined(row.monthlyCostTotalAdjusted, row.monthlyTotal, row.monthlyRentTotal);
    const alignedCost = isLatest && canonicalMonthlyCost ? canonicalMonthlyCost : originalCost;
    const originalRent = Number(row.monthlyRentTotalAdjusted || row.monthlyRentTotal || 0);
    const originalTotal = Number(originalCost || 0);
    const rentRatio = originalTotal > 0 ? originalRent / originalTotal : 1;
    return {
      ...row,
      monthlyCostTotalAdjusted: alignedCost,
      monthlyRentTotalAdjusted: isLatest && canonicalMonthlyCost ? Math.round(Number(alignedCost) * rentRatio) : row.monthlyRentTotalAdjusted,
      monthlyMfTotalAdjusted: isLatest && canonicalMonthlyCost ? Math.round(Number(alignedCost) * (1 - rentRatio)) : row.monthlyMfTotalAdjusted,
      reconciliationBasis: isLatest && canonicalMonthlyCost ? 'current_excel_snapshot_basis' : 'source_rent_trend_basis',
      activeAssetCount: firstDefined(row.activeAssetCount, 0),
      grossFloorAreaDisplay: row.grossFloorAreaDisplay ?? (row.grossFloorAreaSqm != null ? Number(row.grossFloorAreaSqm) / 10000 : null),
    };
  });
  const latestRentTrendRow = rentTrendRows.at(-1) || {};
  const latestTrendMonthlyCost = Number(latestRentTrendRow.monthlyCostTotalAdjusted || 0);
  const trendToKpiGap = canonicalMonthlyCost && latestTrendMonthlyCost ? canonicalMonthlyCost - latestTrendMonthlyCost : 0;
  const leaseSpaceToKpiGap = canonicalMonthlyCost && leaseSpaceMonthlyCost ? canonicalMonthlyCost - leaseSpaceMonthlyCost : 0;
  const weeklyAssetRowsForFallback = useMemo(() => normalizeWeeklyAssetRows(weeklyReportData.assetRows || []), []);
  const mapAssetRows = readableMapPoints.map((point) => {
    const vacancy = readableVacancyRows.find((row) => row.assetId === point.assetId || row.assetName === point.assetName) || {};
    const payload = findAssetPayload(point.assetId, point.assetName);
    const overview = payload?.overview || {};
    return {
      ...point,
      ...vacancy,
      address: firstDefined(point.address, vacancy.address, overview.address),
      grossFloorAreaSqm: firstDefined(point.grossFloorAreaSqm, vacancy.grossFloorAreaSqm, overview.grossFloorAreaSqm, overview.areaBreakdown?.grossFloorAreaSqm),
    };
  });
  const portfolioRows = mapAssetRows.map((row, index) => ({
    ...(() => {
      const option = findAssetOption(row.assetId, row.assetName) || {};
      const payload = findAssetPayload(row.assetId, row.assetName);
      const normalized = payload ? normalizeAssetPayload(payload) : null;
      const overview = normalized?.overview || payload?.overview || {};
      const weeklyRow = weeklyAssetRowsForFallback.find((item) => assetMatchesPermission(row.assetName, { managedAssets: [item] }));
      const useRows = buildUseCategoryRows(payload, option, weeklyRow);
      const coldArea = Number(useRows.find((item) => item.label === '저온창고')?.value || 0);
      const ambientArea = Number(useRows.find((item) => item.label === '상온창고')?.value || 0);
      const weightedENoc = calculateWeightedENoc(normalized?.normalizedRows || [], firstDefined(overview.averageENoc, option.averageENoc));
      const coldRatio = Number(coldArea || 0) + Number(ambientArea || 0) > 0
        ? formatPercent(Number(coldArea || 0) / (Number(coldArea || 0) + Number(ambientArea || 0)))
        : cleanDisplay(overview.coldRatio || option.coldRatio || weeklyRow?.coldRatio, '-');
      return {
        no: formatNumber(index + 1),
        assetName: row.assetName,
        address: formatSigunguAddress(row.address),
        grossFloorAreaPy: formatPyFromSqm(row.grossFloorAreaSqm),
        coldRatio,
        eNoc: formatWon(weightedENoc),
      };
    })(),
  }));
  const portfolioModalRows = portfolioRows.map((row) => [row.no, row.assetName, row.address, row.grossFloorAreaPy, row.coldRatio, row.eNoc]);
  const expiryDetailRows = (data.monthlyExpiryRows || []).flatMap((monthRow) => (
    (monthRow.items || []).map((item) => [
      monthRow.month || monthRow.label || '-',
      item.tenantMasterName || '-',
      item.assetName || '-',
      formatArea(item.leasedAreaSqm),
      formatCurrency(item.monthlyRentTotal),
      formatCurrency(item.monthlyMfTotal),
      formatCurrency(item.monthlyCostTotal),
      item.rentPerPy != null ? formatNumber(item.rentPerPy) : '-',
      item.mfPerPy != null ? formatNumber(item.mfPerPy) : '-',
      item.eNoc != null ? formatNumber(item.eNoc) : '-',
      item.detailAreaLabel || item.floorLabel || '-',
    ])
  ));
  const tenantContractGroups = useMemo(() => buildTenantContractGroups(generalRows), [generalRows]);
  const tenantContractRows = tenantContractGroups.map((row) => [
    <span key={`${row.key}-tenant`} title={row.tenantMasterName} className="whitespace-nowrap">{row.tenantMasterName}</span>,
    formatNumber(row.assetNames.length),
    formatNumber(row.rowCount),
    <span key={`${row.key}-assets`} className="block whitespace-pre-line break-keep text-left leading-5" title={row.assetNames.join(', ')}>{row.assetNames.join('\n')}</span>,
    formatArea(row.leasedAreaSqm),
    formatCurrency(row.monthlyRentTotal),
    formatCurrency(row.monthlyMfTotal),
    formatCurrency(row.monthlyCostTotal),
    formatWon(row.rentPerPy),
    formatWon(row.mfPerPy),
    formatWon(row.costPerPy),
    formatDate(row.latestExpiry),
  ]);
  const monthlyCostEvidenceRows = tenantContractGroups
    .filter((row) => Number(row.monthlyCostTotal || 0) > 0)
    .map((row) => ({
      label: row.tenantMasterName,
      tenantMasterName: row.tenantMasterName,
      value: Number(row.monthlyCostTotal || 0),
      assetCount: row.assetNames.length || 0,
      latestExpiry: row.latestExpiry,
      exposureAvailable: true,
    }))
    .sort((a, b) => b.value - a.value);
  const filteredHomeMetrics = {
    operatingAssetCount: readableMapPoints.length || mapAssetRows.length,
    leasedArea: sumRows(generalRows, (row) => row.leasedAreaSqm),
    vacancyArea: sumRows(readableVacancyRows, (row) => row.vacancyAreaSqm),
    grossArea: sumRows(readableVacancyRows, (row) => row.grossFloorAreaSqm),
  };
  filteredHomeMetrics.vacancyRate = filteredHomeMetrics.grossArea > 0 ? filteredHomeMetrics.vacancyArea / filteredHomeMetrics.grossArea : data.vacancyRate;

  const openTableModal = (title, headers, rows) => setModal({ title, headers, rows });
  const openTenantContractDetail = (tenant) => setModal({
    title: `임차인 계약 상세 · ${tenant.tenantMasterName}`,
    content: (
      <div className="space-y-4">
        <DataTable
          headers={['항목', '내용']}
          rows={[
            ['임차인명', tenant.tenantMasterName],
            ['임차 자산 수', `${formatNumber(tenant.assetNames.length)}개`],
            ['계약 구역 수', `${formatNumber(tenant.rowCount)}건`],
            ['총 임대면적', formatArea(tenant.leasedAreaSqm)],
            ['월 임대료', formatCurrency(tenant.monthlyRentTotal)],
            ['월 관리비', formatCurrency(tenant.monthlyMfTotal)],
            ['월 임관리비', formatCurrency(tenant.monthlyCostTotal)],
            ['평당 월 임대료', formatWon(tenant.rentPerPy)],
            ['평당 월 관리비', formatWon(tenant.mfPerPy)],
            ['평당 월 임관리비', formatWon(tenant.costPerPy)],
            ['최근 만기일', formatDate(tenant.latestExpiry)],
          ]}
          compact
        />
        <DataTable
          headers={['자산명', '펀드명', '층/구역', '저온/상온', '임대면적(평)', '계약개시', '계약만기', '월 임대료', '월 관리비', '월 임관리비', '평당 임대료', '평당 관리비', '평당 임관리비', 'E.NOC']}
          rows={tenant.rows.map((row) => [
            row.assetName || '-',
            row.fundName || '-',
            row.spaceLabel || row.floorLabel || row.detailAreaLabel || '-',
            cleanDisplay(firstDefined(row.coldStorageType, row.temperatureType), '-'),
            formatArea(row.leasedAreaSqm),
            formatDate(row.currentStartDate),
            formatDate(row.currentEndDate),
            formatCurrency(row.currentMonthlyRentTotal),
            formatCurrency(row.currentMonthlyMfTotal),
            formatCurrency(row.monthlyCostTotal),
            formatWon(firstDefined(row.currentRentPerPy, row.rentPerPy)),
            formatWon(firstDefined(row.currentMfPerPy, row.mfPerPy)),
            formatWon(calculatePerPy(row.monthlyCostTotal, row.leasedAreaSqm)),
            formatWon(row.eNoc),
          ])}
          compact
        />
        <div className="rounded-[10px] border border-[#333333] bg-[#1F1F1E] px-4 py-3 text-[12px] leading-5 text-[#A1A1AA]">
          이 화면은 조회 전용입니다. Excel 원본의 추가, 수정, 삭제 요청은 Data Quality 탭에서 source row/source cell 기준으로 처리합니다.
        </div>
      </div>
    ),
  });
  const kpiCards = [
    ['운영 자산 수', formatMetric(filteredHomeMetrics.operatingAssetCount, 'number'), DASHBOARD_BASIS_LABEL, () => openTableModal('운영 자산 목록', ['자산명', '주소', '연면적(평)', '공실률'], mapAssetRows.map((row) => [row.assetName, row.address || '-', formatArea(row.grossFloorAreaSqm), formatPercent(row.vacancyRate)]))],
    ['총 임대면적', formatMetric(filteredHomeMetrics.leasedArea, 'area'), DASHBOARD_BASIS_LABEL, () => openTableModal('총 임대면적 근거', ['자산명', '연면적(평)', '공실면적(평)', '공실률'], readableVacancyRows.map((row) => [row.assetName, formatArea(row.grossFloorAreaSqm), formatArea(row.vacancyAreaSqm), formatPercent(row.vacancyRate)]))],
    ['총 공실면적', formatMetric(filteredHomeMetrics.vacancyArea, 'area'), DASHBOARD_BASIS_LABEL, () => openTableModal('총 공실면적 근거', ['자산명', '공실면적(평)', '공실률'], readableVacancyRows.map((row) => [row.assetName, formatArea(row.vacancyAreaSqm), formatPercent(row.vacancyRate)]))],
    ['공실률', formatMetric(filteredHomeMetrics.vacancyRate, 'percent'), DASHBOARD_BASIS_LABEL, () => openTableModal('공실률 계산 근거', ['항목', '내용'], [['기준시점', DASHBOARD_BASIS_LABEL], ['연면적(평)', formatArea(filteredHomeMetrics.grossArea)], ['임대면적(평)', formatArea(filteredHomeMetrics.leasedArea)], ['공실면적(평)', formatArea(filteredHomeMetrics.vacancyArea)], ['공실률', formatPercent(filteredHomeMetrics.vacancyRate)]])],
    ['월 임관리비 총액', formatMetric(canonicalMonthlyCost, 'currency'), `${DASHBOARD_BASIS_LABEL} · 자산 snapshot 기준`, () => openTableModal('월 임관리비 총액 근거', ['구분', '값', '비고'], [['기준시점', DASHBOARD_BASIS_LABEL, 'Home snapshot'], ['자산 snapshot 합계', formatCurrency(assetSnapshotMonthlyCost), 'KPI/자산별 도넛 기준'], ['Lease space 합계', formatCurrency(leaseSpaceMonthlyCost), '임차인 계약 row 기준'], ['차이', formatCurrency(leaseSpaceToKpiGap), 'Data Quality reconciliation 대상'], ...monthlyCostEvidenceRows.map((row) => [row.tenantMasterName, formatCurrency(row.value), `${formatNumber(row.assetCount)}개 자산 · 최근 만기 ${formatDate(row.latestExpiry)}`])])],
  ];
  const composition = home.composition || {};
  const selectedCompositionPayload = compositionAssetId === 'all' ? null : findAssetPayload(compositionAssetId);
  const selectedCompositionOption = compositionAssetId === 'all' ? null : findAssetOption(compositionAssetId);
  const selectedCompositionWeeklyRow = selectedCompositionOption
    ? weeklyAssetRowsForFallback.find((item) => assetMatchesPermission(selectedCompositionOption.assetName, { managedAssets: [item] }))
    : null;
  const portfolioUseCategoryRows = mergeUseCategoryRows(readableAssetOptions.map((asset) => {
    const payload = findAssetPayload(asset.assetId, asset.assetName);
    const weeklyRow = weeklyAssetRowsForFallback.find((item) => assetMatchesPermission(asset.assetName, { managedAssets: [item] }));
    return buildUseCategoryRows(payload, asset, weeklyRow || {});
  }));
  const coldStorageRows = selectedCompositionPayload
    ? buildUseCategoryRows(selectedCompositionPayload, selectedCompositionOption || {}, selectedCompositionWeeklyRow || {})
    : (sumRows(portfolioUseCategoryRows, (row) => row.value) > 0 ? portfolioUseCategoryRows : normalizeUseCategoryRows(composition.coldStorage || []));
  const coldStorageTotal = sumRows(coldStorageRows, (row) => row.value);
  const assetMonthlyCostRows = readableAssetOptions
    .filter((row) => Number(row.monthlyCostTotal || 0) > 0)
    .map((row) => ({
      label: row.assetName,
      value: Number(row.monthlyCostTotal || 0),
      recordCount: row.uniqueTenantCount || 0,
    }))
    .sort((a, b) => b.value - a.value);
  const tenantMonthlyCostRows = monthlyCostEvidenceRows
    .map((row) => ({
      label: row.tenantMasterName,
      value: row.value,
      recordCount: row.assetCount,
    }))
    .sort((a, b) => b.value - a.value);
  const monthlyCostSourceRows = costCompositionMode === 'asset' ? assetMonthlyCostRows : tenantMonthlyCostRows;
  const monthlyCostCompositionRows = compactCompositionRows(
    monthlyCostSourceRows,
    8,
    costCompositionMode === 'asset' ? '기타 자산' : '기타/미분류 임차인',
  );
  const monthlyCostCompositionTotal = sumRows(monthlyCostSourceRows, (row) => row.value) || canonicalMonthlyCost;
  const monthlyCostCompositionTitle = costCompositionMode === 'asset' ? '자산별 월 임관리비 비중' : '임차인별 월 임관리비 비중';
  const sectorTopAssetsSource = sectorAssetSort === 'area' ? sectorData.rankings?.assetsByArea : sectorData.rankings?.assetsByRent;
  const sectorTopTenantsSource = sectorTenantSort === 'area' ? sectorData.rankings?.tenantsByArea : sectorData.rankings?.tenantsByRent;
  const sectorTopAssets = filterAssetsByPermission(sectorTopAssetsSource || [], permission).slice().sort((a, b) => (
    sectorAssetSort === 'area'
      ? Number(b.leasedAreaSqm || 0) - Number(a.leasedAreaSqm || 0)
      : Number(firstDefined(b.monthlyCostTotal, b.monthlyRentTotal, 0)) - Number(firstDefined(a.monthlyCostTotal, a.monthlyRentTotal, 0))
  )).slice(0, 10);
  const sectorTopTenants = (tenantContractGroups.length ? tenantContractGroups : sectorTopTenantsSource || []).slice().sort((a, b) => (
    sectorTenantSort === 'area'
      ? Number(b.leasedAreaSqm || 0) - Number(a.leasedAreaSqm || 0)
      : Number(firstDefined(b.monthlyCostTotal, b.monthlyRentTotal, 0)) - Number(firstDefined(a.monthlyCostTotal, a.monthlyRentTotal, 0))
  )).slice(0, 10);
  const topTenantNameByAsset = useMemo(() => {
    const assetTenantMap = new Map();
    (generalRows || []).forEach((row) => {
      const assetName = row.assetName || row.asset || '';
      const tenantName = firstDefined(row.tenantMasterName, row.tenantName, row.companyName, '');
      if (!assetName || !tenantName) return;
      if (!assetTenantMap.has(assetName)) assetTenantMap.set(assetName, new Map());
      const tenantMap = assetTenantMap.get(assetName);
      const current = tenantMap.get(tenantName) || { tenantName, monthlyCostTotal: 0, leasedAreaSqm: 0 };
      const rent = Number(firstDefined(row.currentMonthlyRentTotal, row.monthlyRentTotal, 0) || 0);
      const mf = Number(firstDefined(row.currentMonthlyMfTotal, row.monthlyMfTotal, 0) || 0);
      current.monthlyCostTotal += Number(firstDefined(row.monthlyCostTotal, row.monthlyCombinedTotal, rent + mf, 0) || 0);
      current.leasedAreaSqm += Number(firstDefined(row.leasedAreaSqm, row.currentLeasedAreaSqm, 0) || 0);
      tenantMap.set(tenantName, current);
    });
    return Object.fromEntries([...assetTenantMap.entries()].map(([assetName, tenantMap]) => {
      const topTenant = [...tenantMap.values()].sort((a, b) => (
        Number(b.monthlyCostTotal || 0) - Number(a.monthlyCostTotal || 0)
        || Number(b.leasedAreaSqm || 0) - Number(a.leasedAreaSqm || 0)
      ))[0];
      return [assetName, topTenant?.tenantName || '-'];
    }));
  }, [generalRows]);
  const regionRows = Object.values(generalRows.reduce((acc, row) => {
    const region = deriveLogisticsRegionFromAddress(row.standardizedAddress || row.address || row.region, row.region || '미분류');
    if (!acc[region]) acc[region] = { label: region, assetCountSet: new Set(), grossFloorAreaSqm: 0, leasedAreaSqm: 0, monthlyCostTotal: 0 };
    const assetKey = row.assetId || row.assetName;
    if (!acc[region].assetCountSet.has(assetKey)) {
      acc[region].assetCountSet.add(assetKey);
      acc[region].grossFloorAreaSqm += Number(row.grossFloorAreaSqm || 0);
    }
    acc[region].leasedAreaSqm += Number(row.leasedAreaSqm || 0);
    acc[region].monthlyCostTotal += Number(row.monthlyCostTotal || 0);
    return acc;
  }, {})).map((row) => ({ ...row, assetCount: row.assetCountSet.size })).sort((a, b) => (
    regionMetric === 'area'
      ? Number(b.grossFloorAreaSqm || 0) - Number(a.grossFloorAreaSqm || 0)
      : Number(b.monthlyCostTotal || 0) - Number(a.monthlyCostTotal || 0)
  ));
  const sectorAssetRows = sectorTopAssets.map((row) => [row.assetName, formatCurrency(firstDefined(row.monthlyCostTotal, row.monthlyRentTotal)), formatArea(row.leasedAreaSqm), topTenantNameByAsset[row.assetName] || '-']);
  const sectorTenantRows = sectorTopTenants.map((row) => [row.tenantMasterName, formatCurrency(row.monthlyRentTotal), formatCurrency(row.monthlyMfTotal), formatCurrency(firstDefined(row.monthlyCostTotal, Number(row.monthlyRentTotal || 0) + Number(row.monthlyMfTotal || 0))), formatArea(row.leasedAreaSqm)]);
  const regionExposureRows = regionRows.map((row) => [row.label, formatNumber(row.assetCount), formatArea(row.grossFloorAreaSqm), formatCurrency(row.monthlyCostTotal)]);
  const regionChartRows = regionRows.map((row) => ({
    ...row,
    value: regionMetric === 'area' ? row.grossFloorAreaSqm : row.monthlyCostTotal,
  }));

  return (
    <div className="space-y-6">
      <LogisticsModal modal={modal} onClose={() => setModal(null)} />
      <section className="grid grid-cols-1 md:grid-cols-5 gap-3">
        {kpiCards.map(([label, value, basis, action]) => (
          <button key={label} type="button" onClick={action} className="text-left rounded-[14px] border border-[#333333] bg-[#252524] px-4 py-4 hover:bg-[#2A2A29]">
            <div className="text-[12px] text-[#86868B] font-semibold">{label}</div>
            <div className="text-[22px] text-white font-semibold mt-2">{value}</div>
            <div className="mt-1 text-[11px] font-medium text-[#86868B]">{basis}</div>
          </button>
        ))}
      </section>

      <section className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
        <SectionHeader
          eyebrow="LOCATION"
          title="포트폴리오 위치"
          right={(
            <div className="flex gap-2">
              <button type="button" onClick={() => setModal({ title: '포트폴리오 위치', content: <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.82fr_1.18fr]"><PortfolioMapPlot points={readableMapPoints} /><PortfolioAssetTable rows={portfolioRows} /></div> })} className="h-9 px-3 rounded-[8px] bg-white text-[#1F1F1E] text-[13px] font-semibold hover:bg-[#E5E5E5]">지도 크게 보기</button>
              <button type="button" onClick={() => openTableModal('포트폴리오 자산 목록', ['No.', '자산명', '주소(시군구)', '연면적(평)', '저온창고 비율', 'E. NOC'], portfolioModalRows)} className="h-9 px-3 rounded-[8px] bg-[#30302F] text-white text-[13px] font-semibold hover:bg-[#3A3A3A]">자산 표</button>
            </div>
          )}
        />
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.82fr_1.18fr]">
          <PortfolioMapPlot points={readableMapPoints} />
          <div className="custom-scrollbar min-h-0 xl:max-h-[520px] xl:overflow-auto">
            <PortfolioAssetTable rows={portfolioRows} />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
          <SectionHeader
            eyebrow="COMPOSITION"
            title="용도별 비율"
            right={(
              <div className="flex flex-wrap items-center justify-end gap-2">
                <select value={compositionAssetId} onChange={(event) => setCompositionAssetId(event.target.value)} className="h-9 max-w-[260px] rounded-[8px] border border-[#3A3A3C] bg-[#1F1F1E] px-3 text-[13px] text-white">
                  <option value="all">전체</option>
                  {readableAssetOptions.map((asset) => <option key={asset.assetId} value={asset.assetId}>{asset.assetName}</option>)}
                </select>
                <button type="button" onClick={() => openTableModal('용도별 비율 상세', ['구분', '비중', '면적', '행 수'], coldStorageRows.map((row) => [row.label, formatPercent(Number(row.value || 0) / Math.max(coldStorageTotal, 1)), formatArea(row.value), `${formatNumber(row.recordCount)}건`]))} className="h-9 px-3 rounded-[8px] bg-[#30302F] text-white text-[13px] font-semibold hover:bg-[#3A3A3A]">구성 표 보기</button>
              </div>
            )}
          />
          <DoughnutBreakdownChart rows={coldStorageRows} valueType="area" title="용도별 면적 비중" onClick={() => openTableModal('용도별 비율 상세', ['구분', '비중', '면적', '행 수'], coldStorageRows.map((row) => [row.label, formatPercent(Number(row.value || 0) / Math.max(coldStorageTotal, 1)), formatArea(row.value), `${formatNumber(row.recordCount)}건`]))} onSegmentClick={(row) => openTableModal(`용도별 비율 상세 · ${row.label}`, ['항목', '내용'], [['구분', row.label], ['비중', formatPercent(Number(row.value || 0) / Math.max(coldStorageTotal, 1))], ['면적', formatArea(row.value)], ['행 수', `${formatNumber(row.recordCount)}건`]])} />
        </div>
        <div className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
          <SectionHeader
            eyebrow="COMPOSITION"
            title="월 임관리비 비중"
            right={(
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex rounded-[8px] border border-[#3A3A3C] bg-[#1F1F1E] p-1">
                  {[
                    ['asset', '자산별'],
                    ['tenant', '임차인별'],
                  ].map(([value, label]) => (
                    <button key={value} type="button" onClick={() => setCostCompositionMode(value)} className={`h-8 rounded-[6px] px-3 text-[12px] font-semibold ${costCompositionMode === value ? 'bg-white text-[#1F1F1E]' : 'text-[#A1A1AA] hover:text-white'}`}>{label}</button>
                  ))}
                </div>
                <button type="button" onClick={() => openTableModal(monthlyCostCompositionTitle, [costCompositionMode === 'asset' ? '자산명' : '임차인명', '비중', '월 임관리비', costCompositionMode === 'asset' ? '임차인 수' : '자산 수'], monthlyCostSourceRows.map((row) => [row.label, formatPercent(Number(row.value || 0) / Math.max(monthlyCostCompositionTotal, 1)), formatCurrency(row.value), `${formatNumber(row.recordCount)}개`]))} className="h-9 px-3 rounded-[8px] bg-[#30302F] text-white text-[13px] font-semibold hover:bg-[#3A3A3A]">구성 표 보기</button>
              </div>
            )}
          />
          <DoughnutBreakdownChart rows={monthlyCostCompositionRows} valueType="currency" title={monthlyCostCompositionTitle} onClick={() => openTableModal(monthlyCostCompositionTitle, [costCompositionMode === 'asset' ? '자산명' : '임차인명', '비중', '월 임관리비', costCompositionMode === 'asset' ? '임차인 수' : '자산 수'], monthlyCostSourceRows.map((row) => [row.label, formatPercent(Number(row.value || 0) / Math.max(monthlyCostCompositionTotal, 1)), formatCurrency(row.value), `${formatNumber(row.recordCount)}개`]))} onSegmentClick={(row) => openTableModal(`${monthlyCostCompositionTitle} · ${row.label}`, ['항목', '내용'], [[costCompositionMode === 'asset' ? '자산명' : '임차인명', row.label], ['비중', formatPercent(Number(row.value || 0) / Math.max(monthlyCostCompositionTotal, 1))], ['월 임관리비', formatCurrency(row.value)], [costCompositionMode === 'asset' ? '임차인 수' : '자산 수', `${formatNumber(row.recordCount)}개`]])} />
        </div>
      </section>

      <section className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
        <SectionHeader
          eyebrow="TREND"
          title="계약 이력 기준 임대료 추이"
          right={<button type="button" onClick={() => openTableModal('임대료 추이 원본 표', ['월', '월 임대료(RF/FO 반영)', '월 관리비', '월 임관리비(RF/FO 반영)', '원 월임대료', '원 월관리비', '원 월임관리비', '자산 수', '총 연면적(평)', '신규 편입 자산'], rentTrendRows.map((row) => [row.month, formatCurrency(row.monthlyRentTotalAdjusted), formatCurrency(row.monthlyMfTotalAdjusted), formatCurrency(row.monthlyCostTotalAdjusted), formatCurrency(row.monthlyRentTotal), formatCurrency(row.monthlyMfTotal), formatCurrency(row.monthlyTotal), formatNumber(row.activeAssetCount), formatArea(row.grossFloorAreaSqm), formatNewlyAddedAssets(row)]))} className="h-9 px-3 rounded-[8px] bg-[#30302F] text-white text-[13px] font-semibold hover:bg-[#3A3A3A]">원본 표 보기</button>}
        />
        <RichTrendChart
          rows={rentTrendRows}
          labelKey="month"
          leftValueType="currency"
          rightValueType="count"
          rightAxisColor="#C7A6FF"
          onClick={() => openTableModal('임대료 추이 원본 표', ['월', '월 임대료(RF/FO 반영)', '월 관리비', '월 임관리비(RF/FO 반영)', '월 임대료', '월 관리비', '월 임관리비', '자산 수', '총 연면적(평)', '신규 편입 자산'], rentTrendRows.map((row) => [row.month, formatCurrency(row.monthlyRentTotalAdjusted), formatCurrency(row.monthlyMfTotalAdjusted), formatCurrency(row.monthlyCostTotalAdjusted), formatCurrency(row.monthlyRentTotal), formatCurrency(row.monthlyMfTotal), formatCurrency(row.monthlyTotal), formatNumber(row.activeAssetCount), formatArea(row.grossFloorAreaSqm), formatNewlyAddedAssets(row)]))}
          extraTooltipRows={(row) => [{
            label: '신규 편입 자산',
            value: formatNewlyAddedAssets(row),
          }]}
          series={[
            { key: 'monthlyRentTotalAdjusted', label: '월 임대료(RF/FO 반영)', valueType: 'currency' },
            { key: 'monthlyMfTotalAdjusted', label: '월 관리비', valueType: 'currency' },
            { key: 'monthlyCostTotalAdjusted', label: '월 임관리비(RF/FO 반영)', valueType: 'currency' },
            { key: 'activeAssetCount', label: '자산 수', valueType: 'count', axis: 'right', color: '#C7A6FF' },
          ]}
        />
        {trendToKpiGap ? (
          <div className="mt-3 rounded-[12px] border border-[#3A3A3C] bg-[#1F1F1E] px-4 py-3 text-[12px] leading-5 text-[#A1A1AA]">
            최신 월 표시는 현재 포트폴리오 Excel snapshot 기준 월 임관리비 {formatCurrency(canonicalMonthlyCost)}에 맞춰 정렬했습니다. 원본 rent history 기준 차이 {formatCurrency(trendToKpiGap)}는 Data Quality의 월 임관리비 reconciliation 항목에서 source cell 기준으로 별도 검증합니다.
          </div>
        ) : null}
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
          <SectionHeader eyebrow="SECTOR TOP" title="Top 자산" right={(
            <div className="flex items-center gap-2">
              <div className="flex rounded-[8px] border border-[#3A3A3C] bg-[#1F1F1E] p-1">
                {[
                  ['cost', '임관리비'],
                  ['area', '면적'],
                ].map(([value, label]) => (
                  <button key={value} type="button" onClick={() => setSectorAssetSort(value)} className={`h-8 rounded-[6px] px-3 text-[12px] font-semibold ${sectorAssetSort === value ? 'bg-white text-[#1F1F1E]' : 'text-[#A1A1AA] hover:text-white'}`}>{label}</button>
                ))}
              </div>
              <button type="button" onClick={() => openTableModal('Top 자산', ['자산명', '월 임관리비', '임대면적(평)', '핵심 임차인'], sectorAssetRows)} className="h-9 px-3 rounded-[8px] bg-[#30302F] text-white text-[13px] font-semibold hover:bg-[#3A3A3A]">상세</button>
            </div>
          )} />
          <DataTable headers={['자산명', '월 임관리비', '임대면적(평)', '핵심 임차인']} rows={sectorAssetRows} compact />
        </div>
        <div className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
          <SectionHeader eyebrow="SECTOR TOP" title="Top 임차인" right={(
            <div className="flex items-center gap-2">
              <div className="flex rounded-[8px] border border-[#3A3A3C] bg-[#1F1F1E] p-1">
                {[
                  ['cost', '임관리비'],
                  ['area', '면적'],
                ].map(([value, label]) => (
                  <button key={value} type="button" onClick={() => setSectorTenantSort(value)} className={`h-8 rounded-[6px] px-3 text-[12px] font-semibold ${sectorTenantSort === value ? 'bg-white text-[#1F1F1E]' : 'text-[#A1A1AA] hover:text-white'}`}>{label}</button>
                ))}
              </div>
              <button type="button" onClick={() => openTableModal('Top 임차인', ['임차인명', '월 임대료', '월 관리비', '월 임관리비', '임대면적(평)'], sectorTenantRows)} className="h-9 px-3 rounded-[8px] bg-[#30302F] text-white text-[13px] font-semibold hover:bg-[#3A3A3A]">상세</button>
            </div>
          )} />
          <DataTable headers={['임차인명', '월 임대료', '월 관리비', '월 임관리비', '임대면적(평)']} rows={sectorTenantRows} compact />
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
          <SectionHeader eyebrow="VACANCY" title="공실 요약" />
          <DataTable headers={['자산명', '연면적(평)', '공실면적(평)', '공실률']} rows={readableVacancyRows.map((row) => [row.assetName, formatArea(row.grossFloorAreaSqm), formatArea(row.vacancyAreaSqm), formatPercent(row.vacancyRate)])} compact />
        </div>
        <div className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
          <SectionHeader
            eyebrow="EXPIRY"
            title="만기 집중도"
            right={<button type="button" onClick={() => openTableModal('만기 집중도 월별 상세', ['만기월', '임차인', '자산', '임대면적(평)', '월 임대료', '월 관리비', '월 임관리비', '평당 월 임대료', '평당 월 관리비', 'E.NOC', '공간'], expiryDetailRows)} className="h-9 px-3 rounded-[8px] bg-[#30302F] text-white text-[13px] font-semibold hover:bg-[#3A3A3A]">월별 상세 보기</button>}
          />
          <RichTrendChart
            rows={data.monthlyExpiryRows}
            labelKey="month"
            leftValueType="area"
            rightValueType="count"
            rightAxisColor="#FFD166"
            chartHeight={520}
            chartHeightClass="h-[500px]"
            onClick={() => openTableModal('만기 집중도 월별 상세', ['만기월', '임차인', '자산', '임대면적(평)', '월 임대료', '월 관리비', '월 임관리비', '평당 월 임대료', '평당 월 관리비', 'E.NOC', '공간'], expiryDetailRows)}
            series={[
              { key: 'expiringAreaSqm', label: '만기 임대면적', valueType: 'area', chartType: 'bar', color: '#9AD7FF' },
              { key: 'uniqueTenantCount', label: '만기 임차인 수', valueType: 'count', axis: 'right', color: '#FFD166' },
            ]}
          />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5">
        <div className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
          <SectionHeader
            eyebrow="REGION"
            title="권역별 노출도"
            right={(
              <div className="flex items-center gap-2">
                <div className="flex rounded-[8px] border border-[#3A3A3C] bg-[#1F1F1E] p-1">
                  {[
                    ['cost', '임관리비'],
                    ['area', '연면적'],
                  ].map(([value, label]) => (
                    <button key={value} type="button" onClick={() => setRegionMetric(value)} className={`h-8 rounded-[6px] px-3 text-[12px] font-semibold ${regionMetric === value ? 'bg-white text-[#1F1F1E]' : 'text-[#A1A1AA] hover:text-white'}`}>{label}</button>
                  ))}
                </div>
                <button type="button" onClick={() => openTableModal('권역별 노출도', ['권역', '자산 수', '연면적(평)', '월 임관리비'], regionExposureRows)} className="h-9 px-3 rounded-[8px] bg-[#30302F] text-white text-[13px] font-semibold hover:bg-[#3A3A3A]">상세</button>
              </div>
            )}
          />
          <RichBarChart rows={regionChartRows} labelKey="label" valueKey="value" valueType={regionMetric === 'area' ? 'area' : 'currency'} valueLabel={regionMetric === 'area' ? '권역별 연면적' : '권역별 월 임관리비'} onClick={() => openTableModal('권역별 노출도', ['권역', '자산 수', '연면적(평)', '월 임관리비'], regionExposureRows)} />
        </div>
      </section>

      <section className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
        <SectionHeader
          eyebrow="CONTRACTS"
          title="임차인 계약"
          right={<button type="button" onClick={() => setModal({ title: '임차인 계약 전체', size: 'fullscreen', content: <TenantContractFullView rows={generalRows} /> })} className="h-9 px-3 rounded-[8px] bg-[#30302F] text-white text-[13px] font-semibold hover:bg-[#3A3A3A]">전체 표 보기</button>}
        />
        <DataTable
          headers={['임차인명', '자산 수', '구역 수', '자산 목록', '임대면적(평)', '월 임대료', '월 관리비', '월 임관리비', '평당 월 임대료', '평당 월 관리비', '평당 월 임관리비', '최근 만기일']}
          rows={tenantContractRows}
          onRowClick={(index) => openTenantContractDetail(tenantContractGroups[index])}
          compact
        />
      </section>
    </div>
  );
}

function SimpleBarChart({ rows, labelKey, valueKey, valueType = 'number', onClick }) {
  const chartRows = (rows || []).filter((row) => Number(row?.[valueKey] || 0) > 0).slice(0, 10);
  const maxValue = Math.max(...chartRows.map((row) => Number(row[valueKey] || 0)), 1);
  if (!chartRows.length) return <div className="text-[13px] text-[#86868B]">차트로 표시할 값이 없습니다.</div>;
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[72px_1fr_76px] gap-2 text-[11px] text-[#86868B] px-1">
        <span>Y축 항목</span>
        <span>X축 {valueType === 'currency' ? '금액' : valueType === 'area' ? '면적' : '값'}</span>
        <span className="text-right">최대 {formatMetric(maxValue, valueType)}</span>
      </div>
      {chartRows.map((row) => {
        const value = Number(row[valueKey] || 0);
        return (
          <button key={`${row[labelKey]}-${valueKey}`} type="button" onClick={onClick} className="group relative w-full text-left">
            <div className="flex items-center justify-between gap-3 text-[12px]">
              <span className="text-[#C7C7CC] font-semibold truncate">{row[labelKey] || '-'}</span>
              <span className="text-[#86868B]">{formatMetric(value, valueType)}</span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-[#1F1F1E] overflow-hidden">
              <div className="h-full rounded-full bg-[#9AD7FF] group-hover:bg-[#B5E48C]" style={{ width: `${Math.max(4, (value / maxValue) * 100)}%` }} />
            </div>
            <div className="pointer-events-none absolute right-0 top-8 z-30 hidden min-w-[210px] rounded-[8px] border border-[#3A3A3C] bg-[#101010]/95 px-3 py-2 text-[12px] text-white shadow-xl group-hover:block">
              <div className="font-semibold">{row[labelKey] || '-'}</div>
              <div className="mt-1 text-[#A1A1AA]">{chartMetricLabel(valueKey, valueType)}: {formatMetric(value, valueType)}</div>
              <div className="text-[#86868B]">최대값 대비 {((value / maxValue) * 100).toFixed(1)}%</div>
            </div>
          </button>
        );
      })}
      <div className="relative h-5 border-t border-[#333333] text-[11px] text-[#86868B]">
        <span className="absolute left-0 top-1">0</span>
        <span className="absolute left-1/2 -translate-x-1/2 top-1">{formatMetric(maxValue / 2, valueType)}</span>
        <span className="absolute right-0 top-1">{formatMetric(maxValue, valueType)}</span>
      </div>
      <div className="flex items-center gap-2 text-[11px] text-[#86868B]">
        <span className="inline-block h-2 w-6 rounded-full bg-[#9AD7FF]" /> 막대 길이 = {valueType === 'currency' ? '월 금액' : valueType === 'area' ? '면적' : '수량'}
      </div>
    </div>
  );
}

function RichBarChart({ rows, labelKey, valueKey, valueType = 'number', onClick, valueLabel }) {
  const chartRef = useRef(null);
  const [hoveredBar, setHoveredBar] = useState(null);
  const chartRows = (rows || []).filter((row) => Number(row?.[valueKey] || 0) > 0).slice(0, 10);
  const axis = buildAxisSpec(Math.max(...chartRows.map((row) => Number(row[valueKey] || 0)), 1), valueType);
  const maxValue = axis.max;
  const metricName = valueLabel || chartMetricLabel(valueKey, valueType);
  if (!chartRows.length) return <div className="text-[13px] text-[#86868B]">차트로 표시할 값이 없습니다.</div>;
  return (
    <div ref={chartRef} onMouseLeave={() => setHoveredBar(null)} className="relative rounded-[14px] border border-[#333333] bg-[#1F1F1E] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-[12px]">
        <span className="text-[#86868B]">Y축: 항목 · X축: {metricName}</span>
        <span className="text-[#D1D1D6]"><span className="mr-1 inline-block h-2 w-6 rounded-full bg-[#9AD7FF]" />막대 길이 = {metricName}</span>
      </div>
      <div className="space-y-3">
        {chartRows.map((row) => {
          const value = Number(row[valueKey] || 0);
          const label = chartLabel(row, labelKey);
          return (
            <button
              key={`${label}-${valueKey}`}
              type="button"
              onClick={onClick}
              onMouseEnter={(event) => setHoveredBar({ row, label, value, ...getTooltipPoint(event, chartRef.current, 240, 150) })}
              onMouseMove={(event) => setHoveredBar({ row, label, value, ...getTooltipPoint(event, chartRef.current, 240, 150) })}
              onFocus={() => setHoveredBar({ row, label, value, x: 220, y: 72 })}
              onBlur={() => setHoveredBar(null)}
              aria-label={`${label} ${metricName} ${formatMetric(value, valueType)}`}
              className="group relative w-full cursor-pointer rounded-[10px] px-2 py-1.5 text-left hover:bg-[#282827]"
            >
              <span className="sr-only">{metricName}</span>
              <div className="grid grid-cols-[168px_1fr_152px] items-center gap-3 text-[12px]">
                <span className="truncate font-semibold text-[#E5E5E5]">{label}</span>
                <div className="relative h-5 rounded-full bg-[#151515]">
                  <div className="h-full rounded-full bg-[#9AD7FF] transition-colors group-hover:bg-[#B5E48C]" style={{ width: `${Math.max(3, (value / maxValue) * 100)}%` }} />
                </div>
                <span className="text-right font-semibold text-[#D1D1D6]">{row.displayValue || formatMetric(value, valueType)}</span>
              </div>
            </button>
          );
        })}
      </div>
      <div className="mt-3 grid grid-cols-5 border-t border-[#333333] pt-2 text-[11px] text-[#86868B]">
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
          <span key={tick} className={tick === 1 ? 'text-right' : tick === 0 ? 'text-left' : 'text-center'}>
            {shortChartValue(maxValue * tick, valueType)}
          </span>
        ))}
      </div>
      {hoveredBar ? (
        <div data-testid="chart-tooltip" className="pointer-events-none fixed z-50 w-[240px] rounded-[8px] border border-[#3A3A3C] bg-[#101010]/95 px-3 py-2 text-[12px] text-white shadow-xl" style={{ left: hoveredBar.x, top: hoveredBar.y }}>
          <div className="font-semibold">{hoveredBar.label}</div>
          <div className="mt-1 text-[#A1A1AA]">{metricName}: {hoveredBar.row.displayValue || formatMetric(hoveredBar.value, valueType)}</div>
          <div className="text-[#86868B]">전체 최대값 대비 {((hoveredBar.value / maxValue) * 100).toFixed(1)}%</div>
          {Array.isArray(hoveredBar.row.tooltipLines) ? (
            <div className="mt-2 space-y-1 border-t border-[#3A3A3C] pt-2">
              {hoveredBar.row.tooltipLines.map(([tooltipLabel, tooltipValue]) => (
                <div key={`${tooltipLabel}-${tooltipValue}`} className="flex items-center justify-between gap-3 text-[#D1D1D6]">
                  <span className="min-w-0 truncate">{tooltipLabel}</span>
                  <span className="shrink-0 font-semibold text-white">{tooltipValue}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function DoughnutBreakdownChart({ rows, valueType = 'number', title, onClick, onSegmentClick }) {
  const [hoveredSegment, setHoveredSegment] = useState(null);
  const chartRef = useRef(null);
  const svgRef = useRef(null);
  const sourceRows = (rows || []).filter((row) => Number(row.value || 0) > 0).slice(0, 8);
  const chartRows = sourceRows.slice(0, 8);
  const legendRows = chartRows;
  const total = sourceRows.reduce((sum, row) => sum + Number(row.value || 0), 0);
  const colors = ['#9AD7FF', '#B5E48C', '#FFD166', '#C7A6FF', '#FF9F8A', '#7DD3FC', '#F0ABFC', '#A7F3D0'];
  const colorForLabel = Object.fromEntries(legendRows.map((row, index) => [row.label, USE_CATEGORY_COLORS[row.label] || colors[index % colors.length]]));
  const segments = chartRows.map((row, index) => {
    const value = Number(row.value || 0);
    const percent = total ? (value / total) * 100 : 0;
    const previous = chartRows
      .slice(0, index)
      .reduce((sum, item) => sum + (total ? (Number(item.value || 0) / total) * 100 : 0), 0);
    const startAngle = (previous / 100) * 360 - 90;
    const endAngle = ((previous + percent) / 100) * 360 - 90;
    return {
      row,
      value,
      percent,
      startPercent: previous,
      endPercent: previous + percent,
      startAngle,
      endAngle,
      color: colorForLabel[row.label] || colors[index % colors.length],
      isFullCircle: percent >= 99.9,
    };
  });
  if (!chartRows.length) return <div className="text-[13px] text-[#86868B]">구성 차트 데이터가 없습니다.</div>;
  const segmentFromPointer = (event) => {
    const rect = svgRef.current?.getBoundingClientRect?.();
    if (!rect) return null;
    const x = ((event.clientX - rect.left) / rect.width) * 42;
    const y = ((event.clientY - rect.top) / rect.height) * 42;
    const dx = x - 21;
    const dy = y - 21;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < 11.9 || distance > 20) return null;
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    const percentAtPointer = (((angle + 90 + 360) % 360) / 360) * 100;
    return segments.find((segment) => (
      segment.isFullCircle
      || (percentAtPointer >= segment.startPercent && percentAtPointer <= segment.endPercent)
    )) || null;
  };
  const segmentFromEventTarget = (event) => {
    const label = event.target?.closest?.('[data-segment-label]')?.getAttribute?.('data-segment-label');
    if (!label) return null;
    return segments.find((segment) => segment.row.label === label) || null;
  };
  const showSegmentTooltip = (event, explicitSegment) => {
    const segment = explicitSegment || segmentFromPointer(event) || segmentFromEventTarget(event);
    if (!segment) {
      setHoveredSegment(null);
      return;
    }
    setHoveredSegment({
      row: segment.row,
      value: segment.value,
      percent: segment.percent,
      color: segment.color,
      ...getTooltipPoint(event, chartRef.current, 230, 150),
    });
  };
  const handleSegmentClick = (event, explicitSegment) => {
    event.stopPropagation();
    const segment = explicitSegment || segmentFromPointer(event) || segmentFromEventTarget(event);
    if (!segment) return;
    if (onSegmentClick) onSegmentClick(segment.row);
    else onClick?.();
  };

  return (
    <div ref={chartRef} onMouseLeave={() => setHoveredSegment(null)} className="relative w-full rounded-[14px] border border-[#333333] bg-[#1F1F1E] p-4 text-left">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-[12px] font-semibold text-[#86868B]">{title}</div>
          <div className="mt-1 text-[18px] font-semibold text-white">{formatMetric(total, valueType)}</div>
        </div>
        <button type="button" onClick={onClick} className="h-8 rounded-[8px] border border-[#3A3A3C] bg-[#252524] px-3 text-[12px] font-semibold text-[#D1D1D6] hover:bg-[#30302F]">전체 표</button>
      </div>
      <div className="grid grid-cols-1 items-center gap-3 md:grid-cols-[220px_1fr]">
        <div className="relative mx-auto h-[208px] w-[208px]">
          <svg
            ref={svgRef}
            viewBox="0 0 42 42"
            className="h-full w-full cursor-pointer"
            onMouseMove={(event) => showSegmentTooltip(event)}
            onMouseLeave={() => setHoveredSegment(null)}
            onClick={(event) => handleSegmentClick(event)}
          >
            <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#151515" strokeWidth="8" />
            {segments.map((segment) => {
              const { row, value, percent, startAngle, endAngle, color } = segment;
              const commonProps = {
                className: 'cursor-pointer transition-opacity hover:opacity-90',
                fill: 'transparent',
                stroke: color,
                strokeWidth: 8,
                strokeLinecap: 'butt',
                style: { pointerEvents: 'none' },
                onClick: (event) => handleSegmentClick(event, segment),
              };
              const title = <title>{`${row.label} · ${formatMetric(value, valueType)} · ${formatPercent(percent / 100)}`}</title>;
              if (segment.isFullCircle) {
                return (
                  <circle
                    key={row.label}
                    {...commonProps}
                    data-segment-label={row.label}
                    cx="21"
                    cy="21"
                    r="15.915"
                  >
                    {title}
                  </circle>
                );
              }
              return (
                <path
                  key={row.label}
                  {...commonProps}
                  data-segment-label={row.label}
                  d={describeArcPath(21, 21, 15.915, startAngle, endAngle)}
                >
                  {title}
                </path>
              );
            })}
          </svg>
          <div className="absolute inset-[42px] flex flex-col items-center justify-center rounded-full bg-[#252524] text-center">
            <span className="text-[11px] font-semibold text-[#86868B]">합계</span>
            <span className="mt-1 text-[14px] font-bold text-white">{shortChartValue(total, valueType)}</span>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-1.5">
          {legendRows.map((row, index) => {
            const value = Number(row.value || 0);
            const percent = total ? value / total : 0;
            return (
              <button
                key={row.label}
                type="button"
                onClick={() => (onSegmentClick ? onSegmentClick(row) : onClick?.())}
                className="group relative w-full rounded-[8px] px-2 py-1 text-left hover:bg-[#2A2A29]"
              >
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="min-w-0 truncate font-semibold text-[#E5E5E5]" title={row.label}>
                    <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: colorForLabel[row.label] || colors[index % colors.length] }} />
                    {row.label}
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-right">
                    <span className="font-semibold text-[#D1D1D6]">{formatPercent(percent)}</span>
                    <span className="text-[#86868B]">{shortChartValue(value, valueType)}</span>
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
      {hoveredSegment ? (
        <div data-testid="chart-tooltip" className="pointer-events-none fixed z-50 w-[230px] rounded-[10px] border border-[#4A4A4D] bg-[#101010]/95 px-3 py-2.5 text-[12px] text-white shadow-2xl" style={{ left: hoveredSegment.x, top: hoveredSegment.y }}>
          <div className="font-semibold">
            <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: hoveredSegment.color }} />
            {hoveredSegment.row.label}
          </div>
          <div className="mt-1 flex items-center justify-between gap-3 text-[#D1D1D6]">
            <span>값</span>
            <span className="font-semibold text-white">{formatMetric(hoveredSegment.value, valueType)}</span>
          </div>
          <div className="flex items-center justify-between gap-3 text-[#A1A1AA]">
            <span>비중</span>
            <span>{formatPercent(hoveredSegment.percent / 100)}</span>
          </div>
          <div className="flex items-center justify-between gap-3 text-[#86868B]">
            <span>근거 행</span>
            <span>{formatNumber(hoveredSegment.row.recordCount || 0)}건</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MiniLineChart({ rows, series, labelKey = 'month', onClick }) {
  const chartRows = (rows || []).slice(-24);
  const maxValue = Math.max(...chartRows.flatMap((row) => (series || []).map((item) => Number(row[item.key] || 0))), 1);
  if (!chartRows.length) return <div className="text-[13px] text-[#86868B]">추이로 표시할 값이 없습니다.</div>;
  return (
    <button type="button" onClick={onClick} className="w-full text-left rounded-[12px] border border-[#333333] bg-[#1F1F1E] p-3 hover:bg-[#242423]">
      <div className="grid grid-cols-[54px_1fr] gap-3">
        <div className="relative h-[190px] border-r border-[#333333] text-[11px] text-[#86868B]">
          <span className="absolute right-2 top-0">{formatCurrency(maxValue)}</span>
          <span className="absolute right-2 top-1/2 -translate-y-1/2">{formatCurrency(maxValue / 2)}</span>
          <span className="absolute right-2 bottom-0">0</span>
        </div>
        <div>
          <div className="h-[190px] flex items-end gap-1 border-b border-[#333333]">
        {chartRows.map((row) => {
          const rent = Number(row.monthlyRentTotal || 0);
          const mf = Number(row.monthlyMfTotal || 0);
          const label = chartLabel(row, labelKey);
          return (
            <div key={label} className="group relative flex min-w-[7px] flex-1 flex-col justify-end gap-[2px]">
              <div className="rounded-t-[3px] bg-[#B5E48C]" style={{ height: `${Math.max(2, (mf / maxValue) * 170)}px` }} />
              <div className="rounded-t-[3px] bg-[#9AD7FF]" style={{ height: `${Math.max(2, (rent / maxValue) * 170)}px` }} />
              <div className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 hidden w-[210px] -translate-x-1/2 rounded-[10px] border border-[#3A3A3C] bg-[#101010]/95 p-3 text-[12px] text-white shadow-xl group-hover:block">
                <div className="font-semibold">{label}</div>
                <div className="mt-1 flex justify-between gap-3 text-[#D1D1D6]"><span>월 임대료</span><span>{formatCurrency(rent)}</span></div>
                <div className="flex justify-between gap-3 text-[#D1D1D6]"><span>월 관리비</span><span>{formatCurrency(mf)}</span></div>
                <div className="mt-1 flex justify-between border-t border-[#333333] pt-1 text-[#A1A1AA]"><span>합계</span><span>{formatCurrency(rent + mf)}</span></div>
              </div>
            </div>
          );
        })}
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-[#86868B]">
            <span>{chartRows[0]?.[labelKey]}</span>
            <span>X축: 월</span>
            <span>{chartRows[chartRows.length - 1]?.[labelKey]}</span>
          </div>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-4 text-[12px] text-[#86868B]">
        <span>Y축: 금액</span>
        <span><span className="inline-block w-2 h-2 rounded-full bg-[#9AD7FF] mr-1" />월 임대료</span>
        <span><span className="inline-block w-2 h-2 rounded-full bg-[#B5E48C] mr-1" />월 관리비</span>
      </div>
    </button>
  );
}

function RichStackedPeriodChart({ rows, series, labelKey = 'month', onClick }) {
  const chartRows = (rows || []).slice(-24);
  const activeSeries = (series || []).length ? series : [{ key: 'monthlyRentTotal' }, { key: 'monthlyMfTotal' }];
  const maxValue = Math.max(...chartRows.map((row) => activeSeries.reduce((sum, item) => sum + Number(row[item.key] || 0), 0)), 1);
  const colors = ['#9AD7FF', '#B5E48C', '#FFD166'];
  if (!chartRows.length) return <div className="text-[13px] text-[#86868B]">추이로 표시할 값이 없습니다.</div>;
  return (
    <button type="button" onClick={onClick} className="w-full rounded-[14px] border border-[#333333] bg-[#1F1F1E] p-4 text-left hover:bg-[#242423]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-[12px]">
        <span className="text-[#86868B]">X축: 월별 기간 · Y축: 월 임대료/관리비 금액</span>
        <span className="text-[#86868B]">막대 hover 시 월별 세부값 표시</span>
      </div>
      <div className="grid grid-cols-[74px_1fr] gap-3">
        <div className="relative h-[230px] border-r border-[#333333] text-[11px] text-[#A1A1AA]">
          {[1, 0.75, 0.5, 0.25, 0].map((tick) => (
            <span key={tick} className="absolute right-2 -translate-y-1/2" style={{ top: `${(1 - tick) * 100}%` }}>
              {shortChartValue(maxValue * tick, 'currency')}
            </span>
          ))}
        </div>
        <div>
          <div className="relative flex h-[230px] items-end gap-1 border-b border-[#333333]">
            {[1, 0.75, 0.5, 0.25].map((tick) => (
              <div key={tick} className="pointer-events-none absolute left-0 right-0 border-t border-dashed border-[#303033]" style={{ bottom: `${tick * 100}%` }} />
            ))}
            {chartRows.map((row, rowIndex) => {
              const label = chartLabel(row, labelKey);
              const total = activeSeries.reduce((sum, item) => sum + Number(row[item.key] || 0), 0);
              const showLabel = chartRows.length <= 10 || rowIndex % Math.ceil(chartRows.length / 8) === 0 || rowIndex === chartRows.length - 1;
              return (
                <div key={label} className="group relative flex min-w-[10px] flex-1 flex-col justify-end">
                  <div className="flex h-full flex-col justify-end gap-[2px]" title={`${label} · 합계 ${formatCurrency(total)}`}>
                    {activeSeries.map((item, index) => {
                      const value = Number(row[item.key] || 0);
                      return (
                        <div
                          key={item.key}
                          className="rounded-t-[3px]"
                          style={{ height: `${Math.max(2, (value / maxValue) * 210)}px`, backgroundColor: colors[index % colors.length] }}
                        />
                      );
                    })}
                  </div>
                  <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-[220px] -translate-x-1/2 rounded-[10px] border border-[#3A3A3C] bg-[#252524] p-3 text-[12px] text-white shadow-xl group-hover:block">
                    <div className="font-semibold">{label}</div>
                    {activeSeries.map((item, index) => (
                      <div key={item.key} className="mt-1 flex justify-between gap-3 text-[#D1D1D6]">
                        <span><span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} />{chartMetricLabel(item.key, 'currency')}</span>
                        <span>{formatCurrency(row[item.key])}</span>
                      </div>
                    ))}
                    <div className="mt-1 flex justify-between border-t border-[#333333] pt-1 text-[#A1A1AA]"><span>합계</span><span>{formatCurrency(total)}</span></div>
                  </div>
                  {showLabel && <span className="mt-2 -rotate-35 text-[10px] text-[#86868B]">{label}</span>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-4 text-[12px] text-[#D1D1D6]">
        {activeSeries.map((item, index) => (
          <span key={item.key}><span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} />{chartMetricLabel(item.key, 'currency')}</span>
        ))}
      </div>
    </button>
  );
}

function StackingPlan({ floors, onTenantClick }) {
  const rows = (floors || []).slice().sort((a, b) => Number(String(b.floorLabel).replace(/[^0-9.-]/g, '')) - Number(String(a.floorLabel).replace(/[^0-9.-]/g, '')));
  if (!rows.length) return <div className="text-[13px] text-[#86868B]">층별 배치 정보가 없습니다.</div>;
  return (
    <div className="space-y-2">
      {rows.map((floor) => (
        <div key={floor.floorLabel} className="grid grid-cols-[52px_1fr] gap-3 items-stretch">
          <div className="rounded-[8px] border border-[#333333] bg-[#1F1F1E] flex items-center justify-center text-[13px] text-white font-semibold">{floor.floorLabel}</div>
          <div className="min-h-[38px] rounded-[8px] border border-[#333333] bg-[#191918] overflow-hidden flex">
            {(floor.tenants || []).map((tenant, index) => (
              <button
                type="button"
                key={`${tenant.tenantId}-${index}`}
                onClick={() => onTenantClick?.(tenant)}
                className="text-left border-r border-[#252524] last:border-r-0 bg-[#263A45] px-3 py-2 text-[12px] text-white overflow-hidden hover:bg-[#315268] focus:outline-none focus:ring-2 focus:ring-[#9AD7FF]"
                style={{ width: `${Math.max(8, Number(tenant.share || 0.08) * 100)}%` }}
                title={`${tenant.tenantMasterName || '-'} · ${formatArea(tenant.leasedAreaSqm)}`}
              >
                <div className="truncate font-semibold">{tenant.tenantMasterName || '-'}</div>
                <div className="truncate text-[#B8DFFF]">{formatArea(tenant.leasedAreaSqm)}</div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function normalizeAssetPayload(payload) {
  const rentLookup = Object.fromEntries((payload.analytics?.rentVsMf || []).map((row) => [row.leaseSpaceId, row]));
  const expiryLookup = Object.fromEntries((payload.analytics?.contractExpiry || []).map((row) => [row.leaseSpaceId, row]));
  const rows = (payload.rows || []).map((row) => {
    const rent = rentLookup[row.leaseSpaceId] || {};
    const expiry = expiryLookup[row.leaseSpaceId] || {};
    const leasedAreaSqm = firstDefined(row.leasedAreaSqm, row.currentLeasedAreaSqm, row.totalLeasedAreaSqm, row.areaSqm);
    const monthlyRentTotal = firstDefined(row.currentMonthlyRentTotal, rent.monthlyRentTotal, row.monthlyRentTotal, row.currentRentTotal);
    const monthlyMfTotal = firstDefined(row.currentMonthlyMfTotal, rent.monthlyMfTotal, row.monthlyMfTotal, row.currentMfTotal);
    const monthlyCombinedTotal = firstDefined(row.currentMonthlyCostTotal, rent.monthlyTotal, row.monthlyCostTotal, Number(monthlyRentTotal || 0) + Number(monthlyMfTotal || 0));
    const derivedENoc = firstDefined(row.eNoc, row.averageENoc, calculatePerPy(monthlyCombinedTotal, leasedAreaSqm));
    return {
      ...row,
      tenantMasterName: firstDefined(row.tenantMasterName, row.tenantName, row.companyName, row.tenantLabel, '-'),
      leasedAreaSqm,
      monthlyRentTotal,
      monthlyMfTotal,
      monthlyCombinedTotal,
      currentRentPerPy: firstDefined(row.currentRentPerPy, rent.rentPerPy),
      currentMfPerPy: firstDefined(row.currentMfPerPy, rent.mfPerPy),
      currentStartDate: firstDefined(row.currentStartDate, row.startDate, row.latestStartDate),
      currentEndDate: firstDefined(row.currentEndDate, expiry.currentEndDate, row.endDate, row.latestExpiry),
      spaceLabel: [row.floorLabel, row.detailAreaLabel].filter(Boolean).join(' / ') || '-',
      eNoc: derivedENoc,
    };
  });
  const corrected = applyAssetDisplayCorrections(payload, rows);
  return {
    ...payload,
    overview: corrected.overview,
    kpis: corrected.kpis,
    normalizedRows: corrected.rows,
    uniqueTenants: payload.analytics?.uniqueTenants || payload.topTenants || [],
    monthlyCostByTenant: payload.analytics?.monthlyCostByTenant || payload.analytics?.coreTenants || [],
    expiryRows: payload.analytics?.expirySnapshot?.entries || payload.analytics?.contractExpiry || [],
  };
}

function buildSpaceLabel(row) {
  const floors = Array.isArray(row.floorLabels) ? row.floorLabels.join(', ') : row.floorLabel;
  const details = Array.isArray(row.detailAreaLabels) ? row.detailAreaLabels.join(', ') : row.detailAreaLabel;
  return [floors, details].filter(Boolean).join(' / ') || '-';
}

function normalizeCompanyPayload(payload) {
  const sourceRows = payload.rows || [];
  const rowByAssetName = new Map(sourceRows.map((row) => [row.assetName, row]));
  const leasedAssets = (payload.leasedAssets || payload.profile?.leasedAssets || []).map((row) => {
    const matched = rowByAssetName.get(row.assetName) || {};
    const asset = matched.asset || {};
    const leasedAreaSqm = firstDefined(row.leasedAreaSqm, matched.leasedAreaSqm, matched.currentLeasedAreaSqm);
    const monthlyRentTotal = firstDefined(row.monthlyRentTotal, matched.currentMonthlyRentTotal, matched.monthlyRentTotal);
    const monthlyMfTotal = firstDefined(row.monthlyMfTotal, matched.currentMonthlyMfTotal, matched.monthlyMfTotal);
    const derivedMonthlyCost = monthlyRentTotal != null || monthlyMfTotal != null ? Number(monthlyRentTotal || 0) + Number(monthlyMfTotal || 0) : null;
    const monthlyCostTotal = firstDefined(row.monthlyCostTotal, matched.currentMonthlyCostTotal, matched.monthlyCostTotal, derivedMonthlyCost);
    return {
      ...matched,
      ...row,
      assetId: firstDefined(matched.assetId, matched.assetCode, asset.assetCode, row.assetId, row.assetCode, row.assetName),
      assetName: row.assetName || matched.assetName || '-',
      address: firstDefined(asset.standardizedAddress, asset.lookupAddress, row.address),
      latitude: firstDefined(asset.latitude, row.latitude),
      longitude: firstDefined(asset.longitude, row.longitude),
      leasedAreaSqm,
      leasedAreaPy: firstDefined(row.leasedAreaPy, Number(leasedAreaSqm || 0) / 3.305785),
      monthlyRentTotal,
      monthlyMfTotal,
      monthlyCostTotal,
      latestExpiry: firstDefined(row.latestExpiry, matched.currentEndDate, matched.latestExpiry),
      spaceLabel: buildSpaceLabel({ ...matched, ...row }),
    };
  });
  const exposureSource = payload.operations?.exposure?.byAsset || leasedAssets.map((row) => ({
    assetName: row.assetName,
    leasedAreaSqm: row.leasedAreaSqm,
    monthlyRentTotal: row.monthlyRentTotal,
    monthlyMfTotal: row.monthlyMfTotal,
    monthlyCostTotal: row.monthlyCostTotal,
  }));
  const mapPoints = (payload.mapPoints || leasedAssets).map((row) => ({
    assetId: firstDefined(row.assetId, row.assetCode, row.assetName),
    assetName: row.assetName || row.label || '-',
    address: firstDefined(row.address, row.standardizedAddress),
    latitude: row.latitude,
    longitude: row.longitude,
  }));
  return {
    ...payload,
    normalizedLeasedAssets: leasedAssets,
    exposureRows: exposureSource.map((row) => ({
      ...row,
      label: row.assetName || row.label || '-',
      monthlyCostTotal: firstDefined(row.monthlyCostTotal, row.monthlyCombinedTotal),
    })),
    normalizedMapPoints: mapPoints,
  };
}

function companyDartRows(profile = {}, financials = {}) {
  const company = profile.company || {};
  return [
    ['표준기업명', firstDefined(company.tenantMasterName, profile.tenantMasterName, '-')],
    ['사업자번호', formatBusinessRegistrationNo(firstDefined(company.businessRegistrationNo, profile.businessRegistrationNo))],
    ['법인등록번호', company.corpRegistrationNo || '-'],
    ['본점소재지', company.headquartersAddress || '-'],
    ['상장여부', company.listedYn || '-'],
    ['그룹명', company.groupName || '-'],
    ['최근 재무제표 연도', company.latestFinancialYear || '-'],
    ['최근 매출', formatCurrency(firstDefined(financials.revenue, company.latestRevenue))],
    ['영업이익', formatCurrency(firstDefined(financials.operatingIncome, company.latestOperatingIncome))],
    ['부채비율', firstDefined(financials.debtRatio, company.latestDebtRatio) == null ? '-' : `${formatNumber(firstDefined(financials.debtRatio, company.latestDebtRatio))}%`],
    ['직원수', firstDefined(financials.employeeCount, company.latestEmployeeCount) == null ? '-' : `${formatNumber(firstDefined(financials.employeeCount, company.latestEmployeeCount))}명`],
  ];
}

function deriveLogisticsRegionFromAddress(address, fallback = '미분류') {
  const text = String(address || '');
  const cityMatch = text.match(/([가-힣]+(?:시|군|구|읍|면|동))/gu) || [];
  const includesAny = (items) => items.some((item) => text.includes(item));
  if (includesAny(['인천광역시', '김포시', '안산시', '시흥시', '광명시', '부천시'])) return '인천';
  if (includesAny(['고양시', '구리시', '파주시', '연천군', '포천시', '동두천시', '양주시', '의정부시', '남양주시', '가평군'])) return '경기 북부';
  if (text.includes('용인시')) {
    if (includesAny(['수지구', '삼가동', '역북동', '중앙동', '이동읍', '남사읍'])) return '경기 서남부';
    if (includesAny(['모현읍', '유림동', '양지면', '동부동', '원삼면', '백암면', '포곡읍'])) return '경기 동남부';
  }
  if (text.includes('안성시')) {
    if (includesAny(['고삼면', '원곡면', '양성면', '공도읍', '대덕면', '미양면', '안성동', '서운면'])) return '경기 서남부';
    if (includesAny(['보개면', '삼죽면', '금광면', '죽산면', '일죽면'])) return '경기 동남부';
  }
  if (includesAny(['군포시', '화성시', '수원시', '평택시', '천안시', '아산시', '안양시', '오산시', '의왕시', '당진시'])) return '경기 서남부';
  if (includesAny(['하남시', '성남시', '광주시', '여주시', '이천시', '진천군', '음성군'])) return '경기 동남부';
  if (includesAny(['광주광역시', '군산시', '익산시', '김제시', '완주군', '전주시', '부안군', '고창군', '정읍시', '임실군', '순창군', '남원시', '영광군', '함평군', '장성군', '담양군', '나주시', '화순군'])) return '전라';
  if (includesAny(['대구광역시', '칠곡군', '성주군', '고령군', '청도군', '경산시', '영천시', '군위군', '김천시', '구미시'])) return '경북';
  if (includesAny(['울산광역시', '양산시', '밀양시', '김해시', '부산광역시', '창원시', '경주시', '포항시'])) return '경남';
  return cityMatch[0] ? fallback : fallback;
}

function reviewStatusLabel(status) {
  const value = cleanDisplay(status, 'ok');
  if (value === 'ok') return '정상';
  if (value === 'review_required') return '검토 필요';
  if (value === 'suspected_error') return '의심 오류';
  return value;
}

function buildLogisticsGeneralRows() {
  const seen = new Set();
  return Object.values(ASSET_PAYLOADS).flatMap((payload) => {
    const normalized = normalizeAssetPayload(payload);
    const overview = normalized.overview || {};
    return (normalized.normalizedRows || []).map((row) => {
      const asset = row.asset || {};
      const manager = row.manager || {};
      const rowKey = row.leaseSpaceId || row.leaseId || `${row.assetId || overview.assetId}-${row.tenantId || row.tenantMasterName}-${row.spaceLabel}`;
      if (seen.has(rowKey)) return null;
      seen.add(rowKey);
      const currentMonthlyRentTotal = firstDefined(row.currentMonthlyRentTotal, row.monthlyRentTotal);
      const currentMonthlyMfTotal = firstDefined(row.currentMonthlyMfTotal, row.monthlyMfTotal);
      const monthlyCostTotal = firstDefined(row.currentMonthlyCostTotal, row.monthlyCombinedTotal, Number(currentMonthlyRentTotal || 0) + Number(currentMonthlyMfTotal || 0));
      const leasedAreaSqm = firstDefined(row.leasedAreaSqm, row.currentLeasedAreaSqm);
      const address = firstDefined(asset.standardizedAddress, overview.standardizedAddress, asset.lookupAddress);
      return {
        ...row,
        assetId: firstDefined(row.assetId, overview.assetId),
        assetName: firstDefined(row.assetName, asset.assetName, overview.assetName, '-'),
        fundName: firstDefined(row.fundName, manager.fundName, overview.fundName, '미분류 펀드'),
        tenantMasterName: firstDefined(row.tenantMasterName, row.company?.tenantMasterName, '-'),
        sector: firstDefined(row.sector, overview.sector, '물류센터'),
        address,
        region: deriveLogisticsRegionFromAddress(address, '미분류'),
        goodsType: cleanDisplay(row.goodsType, '미분류'),
        coldStorageType: normalizeColdStorageLabel(row.coldStorageType),
        calculatedReviewStatus: reviewStatusLabel(row.calculatedReviewStatus || row.reviewStatus),
        grossFloorAreaSqm: firstDefined(row.grossFloorAreaSqm, asset.grossFloorAreaSqm, overview.grossFloorAreaSqm, overview.areaBreakdown?.grossFloorAreaSqm),
        leasedAreaSqm,
        currentMonthlyRentTotal,
        currentMonthlyMfTotal,
        monthlyCostTotal,
        eNoc: firstDefined(row.eNoc, row.averageENoc),
        currentRentPerPy: firstDefined(row.currentRentPerPy, row.rentPerPy, calculatePerPy(currentMonthlyRentTotal, leasedAreaSqm)),
        currentMfPerPy: firstDefined(row.currentMfPerPy, row.mfPerPy, calculatePerPy(currentMonthlyMfTotal, leasedAreaSqm)),
        currentEndDate: firstDefined(row.currentEndDate, row.latestExpiry),
      };
    }).filter(Boolean);
  });
}

function buildTenantContractGroups(rows) {
  const groups = new Map();
  (rows || []).forEach((row) => {
    const tenantName = firstDefined(row.tenantMasterName, row.tenantName, row.companyName, '미분류 임차인');
    const key = firstDefined(row.tenantId, tenantName);
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        tenantMasterName: tenantName,
        businessRegistrationNo: firstDefined(row.businessRegistrationNo, row.company?.businessRegistrationNo, ''),
        assetNames: new Set(),
        rowCount: 0,
        leasedAreaSqm: 0,
        monthlyRentTotal: 0,
        monthlyMfTotal: 0,
        monthlyCostTotal: 0,
        latestExpiry: '',
        rows: [],
      });
    }
    const group = groups.get(key);
    const monthlyRent = Number(firstDefined(row.currentMonthlyRentTotal, row.monthlyRentTotal, 0) || 0);
    const monthlyMf = Number(firstDefined(row.currentMonthlyMfTotal, row.monthlyMfTotal, 0) || 0);
    const monthlyCost = Number(firstDefined(row.monthlyCostTotal, row.monthlyCombinedTotal, monthlyRent + monthlyMf, 0) || 0);
    const leasedArea = Number(firstDefined(row.leasedAreaSqm, row.currentLeasedAreaSqm, 0) || 0);
    group.assetNames.add(row.assetName || '-');
    group.rowCount += 1;
    group.leasedAreaSqm += leasedArea;
    group.monthlyRentTotal += monthlyRent;
    group.monthlyMfTotal += monthlyMf;
    group.monthlyCostTotal += monthlyCost;
    const expiry = formatDate(firstDefined(row.currentEndDate, row.latestExpiry, row.earliestExpiry));
    if (expiry !== '-' && (!group.latestExpiry || expiry > group.latestExpiry)) group.latestExpiry = expiry;
    group.rows.push({
      ...row,
      currentMonthlyRentTotal: monthlyRent,
      currentMonthlyMfTotal: monthlyMf,
      monthlyCostTotal: monthlyCost,
      leasedAreaSqm: leasedArea,
      currentEndDate: expiry,
    });
  });
  return [...groups.values()].map((group) => ({
    ...group,
    assetNames: [...group.assetNames].sort((a, b) => a.localeCompare(b, 'ko-KR')),
    rentPerPy: calculatePerPy(group.monthlyRentTotal, group.leasedAreaSqm),
    mfPerPy: calculatePerPy(group.monthlyMfTotal, group.leasedAreaSqm),
    costPerPy: calculatePerPy(group.monthlyCostTotal, group.leasedAreaSqm),
    rows: group.rows.sort((a, b) => String(a.assetName || '').localeCompare(String(b.assetName || ''), 'ko-KR')),
  })).sort((a, b) => Number(b.monthlyCostTotal || 0) - Number(a.monthlyCostTotal || 0));
}

function metricDefinition(metricKey) {
  return PLAYGROUND_METRICS.find((item) => item.key === metricKey) || PLAYGROUND_METRICS[0];
}

function metricValueFromRow(row, metricKey) {
  if (metricKey === 'count') return 1;
  if (metricKey === 'monthlyCostTotal') return Number(firstDefined(row.monthlyCostTotal, row.currentMonthlyCostTotal, row.monthlyCombinedTotal) || 0);
  if (metricKey === 'vacancyAreaSqm') {
    const gross = Number(row.grossFloorAreaSqm || 0);
    const leased = Number(row.leasedAreaSqm || 0);
    return Math.max(0, gross - leased);
  }
  return Number(row[metricKey] || 0);
}

function aggregateMetricValues(rows, metric, aggregation) {
  if (aggregation === 'count' || metric === 'count') return (rows || []).length;
  const values = (rows || [])
    .map((row) => metricValueFromRow(row, metric))
    .filter((value) => Number.isFinite(value));
  if (!values.length) return 0;
  if (aggregation === 'average') return values.reduce((sum, value) => sum + value, 0) / values.length;
  if (aggregation === 'max') return Math.max(...values);
  if (aggregation === 'min') return Math.min(...values);
  return values.reduce((sum, value) => sum + value, 0);
}

function applyAssetDisplayCorrections(payload, rows) {
  const overview = { ...(payload.overview || {}) };
  const kpis = (payload.kpis || []).map((item) => ({ ...item }));
  let normalizedRows = rows;
  const setKpiValue = (key, value) => {
    const found = kpis.find((item) => item.key === key);
    if (found) found.value = value;
    else kpis.push({ key, label: key, value });
  };

  if (overview.assetId === 'asset_a120085001' || overview.assetName === '경산 쿠팡물류센터') {
    overview.vacancyAreaSqm = 0;
    overview.vacancyRate = 0;
    overview.leasedAreaSqm = firstDefined(overview.grossFloorAreaSqm, overview.leasedAreaSqm);
    setKpiValue('occupancy_rate', 1);
    setKpiValue('leased_area_total', overview.leasedAreaSqm);
    setKpiValue('vacancy_area_total', 0);
  }

  if (overview.assetId === 'asset_a112109001' || overview.assetName === '부산송정물류센터') {
    overview.leasedAreaSqm = 0;
    overview.vacancyAreaSqm = overview.grossFloorAreaSqm || 0;
    overview.vacancyRate = 1;
    overview.tenantCount = 0;
    overview.uniqueTenantCount = 0;
    overview.leaseSpaceCount = 0;
    overview.monthlyRentTotal = null;
    overview.monthlyMfTotal = null;
    overview.monthlyCostTotal = null;
    overview.averageENoc = null;
    normalizedRows = [];
    setKpiValue('occupancy_rate', 0);
    setKpiValue('leased_area_total', 0);
    setKpiValue('vacancy_area_total', overview.vacancyAreaSqm);
    setKpiValue('unique_tenant_count', 0);
    setKpiValue('monthly_total_cost', null);
    setKpiValue('average_e_noc', null);
  }

  if (overview.assetId === 'asset_a112127001' || overview.assetName === '아레나스양지물류센터') {
    normalizedRows = normalizedRows.map((row) => {
      const floor = cleanDisplay(row.floorLabel, '');
      const detail = cleanDisplay(row.detailAreaLabel, '');
      const normalizedDetail = detail === '-' ? '' : detail;
      const fallbackDetail = floor && floor !== '-' ? '섹터 미분리' : '';
      return {
        ...row,
        detailAreaLabel: normalizedDetail || fallbackDetail || row.detailAreaLabel,
        spaceLabel: [floor, normalizedDetail || fallbackDetail].filter(Boolean).join(' / ') || row.spaceLabel || '-',
      };
    });
  }

  return { overview, rows: normalizedRows, kpis };
}

function buildPivotRows(sourceRows, {
  rowDimension,
  columnDimension,
  metric,
  aggregation,
  filterDimension,
  filterValue,
  topN,
  excludeBlank,
}) {
  const filteredRows = (sourceRows || []).filter((row) => {
    if (filterDimension && filterValue && cleanDisplay(row[filterDimension], '미분류') !== filterValue) return false;
    if (!excludeBlank) return true;
    const rowValue = cleanDisplay(row[rowDimension], '');
    const columnValue = columnDimension === 'none' ? '합계' : cleanDisplay(row[columnDimension], '');
    return Boolean(rowValue && columnValue);
  });
  const rawColumnValues = columnDimension === 'none'
    ? ['합계']
    : [...new Set(filteredRows.map((row) => cleanDisplay(row[columnDimension], '미분류')))]
      .sort((a, b) => a.localeCompare(b, 'ko-KR'))
      .slice(0, 10);
  const rowGroups = filteredRows.reduce((acc, row) => {
    const rowKey = cleanDisplay(row[rowDimension], '미분류');
    const columnKey = columnDimension === 'none' ? '합계' : cleanDisplay(row[columnDimension], '미분류');
    if (!acc[rowKey]) acc[rowKey] = { key: rowKey, label: rowKey, sourceRows: [], columns: {} };
    acc[rowKey].sourceRows.push(row);
    if (!acc[rowKey].columns[columnKey]) acc[rowKey].columns[columnKey] = [];
    acc[rowKey].columns[columnKey].push(row);
    return acc;
  }, {});
  const pivotRows = Object.values(rowGroups)
    .map((group) => {
      const cells = Object.fromEntries(rawColumnValues.map((column) => [
        column,
        aggregateMetricValues(group.columns[column] || [], metric, aggregation),
      ]));
      const total = aggregateMetricValues(group.sourceRows, metric, aggregation);
      return { ...group, cells, total, recordCount: group.sourceRows.length };
    })
    .sort((a, b) => Number(b.total || 0) - Number(a.total || 0))
    .slice(0, Number(topN || 15));
  const grandTotal = aggregateMetricValues(filteredRows, metric, aggregation);
  return { rows: pivotRows, columns: rawColumnValues, filteredRows, grandTotal };
}

function SectorDashboard() {
  const sector = sectorData;
  const [modal, setModal] = useState(null);
  const [assetSort, setAssetSort] = useState('rent');
  const [tenantSort, setTenantSort] = useState('rent');
  const kpis = sector.kpis || {};
  const topAssetsSource = assetSort === 'area' ? sector.rankings?.assetsByArea : sector.rankings?.assetsByRent;
  const topTenantsSource = tenantSort === 'area' ? sector.rankings?.tenantsByArea : sector.rankings?.tenantsByRent;
  const topAssets = (topAssetsSource || []).slice().sort((a, b) => (
    assetSort === 'area'
      ? Number(b.leasedAreaSqm || 0) - Number(a.leasedAreaSqm || 0)
      : Number(firstDefined(b.monthlyCostTotal, b.monthlyRentTotal, 0)) - Number(firstDefined(a.monthlyCostTotal, a.monthlyRentTotal, 0))
  ));
  const topTenants = (topTenantsSource || []).slice().sort((a, b) => (
    tenantSort === 'area'
      ? Number(b.leasedAreaSqm || 0) - Number(a.leasedAreaSqm || 0)
      : Number(firstDefined(b.monthlyCostTotal, b.monthlyRentTotal, 0)) - Number(firstDefined(a.monthlyCostTotal, a.monthlyRentTotal, 0))
  ));
  const byMonthlyCost = topTenants.map((row) => ({
    ...row,
    monthlyTotalCost: firstDefined(row.monthlyCostTotal, Number(row.monthlyRentTotal || 0) + Number(row.monthlyMfTotal || 0)),
  }));
  const expiryRows = sector.expiryRows || [];
  const regionRows = (sector.regionExposure || []).map((row) => ({
    ...row,
    label: row.label || row.region || '-',
  }));
  const monthlyRentRows = sector.trends?.monthlyRent || [];
  const expiryWithin12Rows = expiryRows.filter((row) => row.monthsToExpiry != null && Number(row.monthsToExpiry) <= 12);
  const openTableModal = (title, headers, rows) => setModal({ title, headers, rows });
  const openAssetDetail = (row) => setModal({
    title: `자산 랭킹 상세 · ${row.assetName || '-'}`,
    content: (
      <div className="space-y-4">
        <DataTable
          headers={['항목', '내용']}
          rows={[
            ['자산명', row.assetName || '-'],
            ['월 임관리비', formatCurrency(firstDefined(row.monthlyCostTotal, Number(row.monthlyRentTotal || 0) + Number(row.monthlyMfTotal || 0)))],
            ['월 임대료', formatCurrency(row.monthlyRentTotal)],
            ['월 관리비', formatCurrency(row.monthlyMfTotal)],
            ['공실률', formatPercent(row.vacancyRate)],
            ['임대면적', formatArea(row.leasedAreaSqm)],
            ['연면적', formatArea(row.grossFloorAreaSqm)],
            ['주요 임차인 수', `${formatNumber(row.uniqueTenantCount)}개`],
            ['주소', row.standardizedAddress || '-'],
          ]}
          compact
        />
        <DataTable
          headers={['임차인명', 'Lease Space 수', '임대면적', '월 임관리비', '최근 만기']}
          rows={(row.topTenants || []).map((tenant) => [
            tenant.tenantMasterName || '-',
            formatNumber(tenant.leaseSpaceCount),
            formatArea(tenant.leasedAreaSqm),
            formatCurrency(tenant.monthlyCostTotal),
            formatDate(tenant.latestExpiry),
          ])}
          compact
        />
      </div>
    ),
  });
  const openTenantDetail = (row) => setModal({
    title: `임차인 랭킹 상세 · ${row.tenantMasterName || '-'}`,
    content: (
      <div className="space-y-4">
        <DataTable
          headers={['항목', '내용']}
          rows={[
            ['임차인명', row.tenantMasterName || '-'],
            ['자산 수', `${formatNumber(row.assetCount)}개`],
            ['Lease Space 수', `${formatNumber(row.leaseSpaceCount)}개`],
            ['임대면적', formatArea(row.leasedAreaSqm)],
            ['월 임대료', formatCurrency(row.monthlyRentTotal)],
            ['월 관리비', formatCurrency(row.monthlyMfTotal)],
            ['월 임관리비', formatCurrency(firstDefined(row.monthlyCostTotal, row.monthlyTotalCost))],
            ['최근 만기일', formatDate(row.latestExpiry)],
            ['DART 연결 여부', row.company?.dartCorpCode ? '연결됨' : '미연결'],
          ]}
          compact
        />
        <DataTable
          headers={['자산명', '층/세부구역', '임대면적', '월 임관리비', '최근 만기']}
          rows={(row.leasedAssets || []).map((asset) => [
            asset.assetName || '-',
            buildSpaceLabel(asset),
            formatArea(asset.leasedAreaSqm),
            formatCurrency(asset.monthlyCostTotal),
            formatDate(asset.latestExpiry),
          ])}
          compact
        />
      </div>
    ),
  });
  const regionTableRows = regionRows.map((row) => [
    row.label,
    formatNumber(row.assetCount),
    formatArea(row.leasedAreaSqm),
    formatCurrency(row.monthlyCostTotal),
    formatPercent(row.vacancyRate),
  ]);
  const trendTableRows = monthlyRentRows.map((row) => [
    row.month,
    formatCurrency(row.monthlyRentTotal),
    formatCurrency(row.monthlyMfTotal),
  ]);
  const assetTableRows = topAssets.map((row) => [
    row.assetName,
    formatCurrency(firstDefined(row.monthlyCostTotal, Number(row.monthlyRentTotal || 0) + Number(row.monthlyMfTotal || 0))),
    formatArea(row.leasedAreaSqm),
    formatPercent(row.vacancyRate),
  ]);
  const tenantTableRows = byMonthlyCost.map((row) => [
    row.tenantMasterName,
    formatCurrency(row.monthlyRentTotal),
    formatCurrency(row.monthlyMfTotal),
    formatCurrency(row.monthlyTotalCost),
    formatArea(row.leasedAreaSqm),
  ]);

  return (
    <div className="space-y-6">
      <LogisticsModal modal={modal} onClose={() => setModal(null)} />
      <section className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
        <div>
          <div className="text-[12px] text-[#86868B] font-semibold">시장 인텔리전스</div>
          <h3 className="text-[26px] text-white font-semibold mt-1">권역·자산·임차인 리스크 비교</h3>
          <p className="text-[13px] text-[#A1A1AA] mt-2">포트폴리오를 권역, 임관리비, 공실, 만기 관점에서 빠르게 비교합니다.</p>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {[
          ['권역 수', `${formatNumber(firstDefined(kpis.regionCount, regionRows.length))}개`],
          ['운영 자산 수', `${formatNumber(firstDefined(kpis.operatingAssetCount, sector.mapPoints?.length))}개`],
          ['총 임대면적', formatArea(kpis.leasedAreaSqm)],
          ['월 임관리비', formatCurrency(kpis.monthlyCostTotal)],
          ['12개월 내 만기', `${formatNumber(firstDefined(kpis.expiryWithin12Months, expiryWithin12Rows.length))}건`],
        ].map(([label, value]) => (
          <button
            key={label}
            type="button"
            onClick={() => {
              if (label === '12개월 내 만기') {
                openTableModal('12개월 내 만기 상세', ['자산명', '임차인명', '계약만기일', '잔여 개월'], expiryWithin12Rows.map((row) => [row.assetName, row.tenantMasterName, formatDate(row.currentEndDate), formatNumber(row.monthsToExpiry)]));
              }
            }}
            className="text-left rounded-[14px] border border-[#333333] bg-[#252524] px-4 py-4 hover:bg-[#2A2A29]"
          >
            <div className="text-[12px] text-[#86868B] font-semibold">{label}</div>
            <div className="text-[22px] text-white font-semibold mt-2">{value}</div>
          </button>
        ))}
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-[1.05fr_0.95fr] gap-5">
        <main className="space-y-5">
          <section className="grid grid-cols-1 gap-5">
            <div className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
              <SectionHeader eyebrow="TREND" title="월 임관리비 추이" right={<button type="button" onClick={() => openTableModal('월 임관리비 추이 원본 표', ['월', '월 임대료', '월 관리비'], trendTableRows)} className="h-9 px-3 rounded-[8px] bg-[#30302F] text-white text-[13px] font-semibold hover:bg-[#3A3A3A]">원본 표 보기</button>} />
              <RichTrendChart
                rows={monthlyRentRows}
                labelKey="month"
                leftValueType="currency"
                onClick={() => openTableModal('월 임관리비 추이 원본 표', ['월', '월 임대료', '월 관리비'], trendTableRows)}
                series={[
                  { key: 'monthlyRentTotal', label: '월 임대료', valueType: 'currency' },
                  { key: 'monthlyMfTotal', label: '월 관리비', valueType: 'currency' },
                ]}
              />
            </div>
            <div className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
              <SectionHeader eyebrow="REGION" title="권역별 노출도" right={<button type="button" onClick={() => openTableModal('권역별 노출도 원본 표', ['권역', '자산 수', '임대면적', '월 임관리비', '공실률'], regionTableRows)} className="h-9 px-3 rounded-[8px] bg-[#30302F] text-white text-[13px] font-semibold hover:bg-[#3A3A3A]">원본 표 보기</button>} />
              <RichBarChart rows={regionRows.map((row) => ({ ...row, value: firstDefined(row.monthlyCostTotal, row.assetCount) }))} labelKey="label" valueKey="value" valueType="currency" valueLabel="권역별 월 임관리비 합계" onClick={() => openTableModal('권역별 노출도 원본 표', ['권역', '자산 수', '임대면적', '월 임관리비', '공실률'], regionTableRows)} />
            </div>
          </section>
        </main>

        <aside className="space-y-5">
          <div className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
            <SectionHeader
              eyebrow="TOP"
              title="Top 자산"
              right={(
                <div className="flex rounded-[8px] border border-[#3A3A3C] bg-[#1F1F1E] p-1">
                  {[
                    ['rent', '임관리비'],
                    ['area', '임대면적'],
                  ].map(([value, label]) => (
                    <button key={value} type="button" onClick={() => setAssetSort(value)} className={`h-8 rounded-[6px] px-3 text-[12px] font-semibold ${assetSort === value ? 'bg-white text-[#1F1F1E]' : 'text-[#A1A1AA] hover:text-white'}`}>{label}</button>
                  ))}
                </div>
              )}
            />
            <div>
              <DataTable headers={['자산명', '월 임관리비', '임대면적', '공실률']} rows={assetTableRows} onRowClick={(index) => openAssetDetail(topAssets[index])} compact />
            </div>
          </div>
          <div className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
            <SectionHeader
              eyebrow="TOP"
              title="Top 임차인"
              right={(
                <div className="flex rounded-[8px] border border-[#3A3A3C] bg-[#1F1F1E] p-1">
                  {[
                    ['rent', '임관리비'],
                    ['area', '임대면적'],
                  ].map(([value, label]) => (
                    <button key={value} type="button" onClick={() => setTenantSort(value)} className={`h-8 rounded-[6px] px-3 text-[12px] font-semibold ${tenantSort === value ? 'bg-white text-[#1F1F1E]' : 'text-[#A1A1AA] hover:text-white'}`}>{label}</button>
                  ))}
                </div>
              )}
            />
            <DataTable headers={['임차인명', '월 임대료', '월 관리비', '월 임관리비', '임대면적']} rows={tenantTableRows} onRowClick={(index) => openTenantDetail(byMonthlyCost[index])} compact />
          </div>
          <div className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
            <SectionHeader eyebrow="EXPIRY" title="만기 집중도" />
            <div className="space-y-2">
              {expiryRows.slice(0, 6).map((row, index) => (
                <div key={`${row.assetName}-${row.tenantMasterName}-${index}`} className="rounded-[12px] border border-[#333333] bg-[#1F1F1E] p-4">
                  <div className="text-[14px] text-white font-semibold">{row.assetName || '-'}</div>
                  <div className="text-[12px] text-[#86868B] mt-1">{row.tenantMasterName || '-'} · {formatDate(row.currentEndDate)} · {formatNumber(row.monthsToExpiry)}개월</div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}

function CompanyDashboard() {
  const { memberInfo } = useAuth();
  const permission = useMemo(() => resolveLogisticsPermission(memberInfo), [memberInfo]);
  const storedTenantId = typeof window !== 'undefined' ? window.sessionStorage.getItem('logisticsSelectedTenantId') : '';
  const defaultTenantId = storedTenantId && COMPANY_PAYLOADS[storedTenantId]
    ? storedTenantId
    : companyOptionsData[0]?.tenantId || Object.keys(COMPANY_PAYLOADS)[0];
  const [selectedTenantId, setSelectedTenantId] = useState(defaultTenantId);
  const [exposureMode, setExposureMode] = useState('cost');
  const [modal, setModal] = useState(null);
  const [dartApiStatus, setDartApiStatus] = useState(null);
  const rawPayload = COMPANY_PAYLOADS[selectedTenantId] || COMPANY_PAYLOADS[defaultTenantId] || Object.values(COMPANY_PAYLOADS)[0];
  const company = useMemo(() => normalizeCompanyPayload(rawPayload || {}), [rawPayload]);
  const profile = company.profile || {};
  const financials = company.financials || {};
  const leasedAssets = useMemo(() => filterAssetsByPermission(company.normalizedLeasedAssets || [], permission), [company.normalizedLeasedAssets, permission]);
  const mapPoints = useMemo(() => filterAssetsByPermission(company.normalizedMapPoints || [], permission), [company.normalizedMapPoints, permission]);
  const visibleProfile = {
    assetCount: new Set(leasedAssets.map((row) => row.assetName)).size,
    leasedAreaSqm: sumRows(leasedAssets, (row) => row.leasedAreaSqm),
    monthlyRentTotal: sumRows(leasedAssets, (row) => row.monthlyRentTotal),
    monthlyMfTotal: sumRows(leasedAssets, (row) => row.monthlyMfTotal),
    monthlyCostTotal: sumRows(leasedAssets, (row) => row.monthlyCostTotal),
  };
  const kpiLookup = Object.fromEntries((company.kpis || []).map((item) => [item.key, item]));
  const kpis = [
    { key: 'asset_count', label: '임차 자산 수', value: visibleProfile.assetCount, valueType: 'number' },
    { key: 'leased_area', label: '총 임차면적', value: visibleProfile.leasedAreaSqm, valueType: 'area' },
    { key: 'monthly_total_cost', label: '월 임관리비 총액', value: visibleProfile.monthlyCostTotal, valueType: 'currency' },
    { key: 'monthly_rent_total', label: '월 임대료 총액', value: visibleProfile.monthlyRentTotal, valueType: 'currency' },
    { key: 'monthly_mf_total', label: '월 관리비 총액', value: visibleProfile.monthlyMfTotal, valueType: 'currency' },
  ].map((item) => ({ ...(kpiLookup[item.key] || {}), ...item }));
  const exposureSourceRows = filterAssetsByPermission(company.exposureRows || [], permission);
  const hasCostExposure = exposureSourceRows.some((row) => Number(firstDefined(row.monthlyCostTotal, row.monthlyCombinedTotal)) > 0);
  const effectiveExposureMode = exposureMode === 'cost' && !hasCostExposure ? 'area' : exposureMode;
  const exposureRows = exposureSourceRows.map((row) => ({
    ...row,
    value: effectiveExposureMode === 'area' ? row.leasedAreaSqm : firstDefined(row.monthlyCostTotal, row.monthlyCombinedTotal),
  })).sort((a, b) => Number(b.value || 0) - Number(a.value || 0));
  const exposureTotal = exposureRows.reduce((sum, row) => sum + Number(row.value || 0), 0);
  const exposureChartRows = exposureRows.map((row) => ({
    ...row,
    displayValue: `${formatMetric(row.value, effectiveExposureMode === 'area' ? 'area' : 'currency')} (${formatPercent(exposureTotal ? Number(row.value || 0) / exposureTotal : 0)})`,
    tooltipLines: [
      ['전체 대비', formatPercent(exposureTotal ? Number(row.value || 0) / exposureTotal : 0)],
      ['임대면적', formatArea(row.leasedAreaSqm)],
      ['월 임관리비', formatCurrency(firstDefined(row.monthlyCostTotal, row.monthlyCombinedTotal))],
    ],
  }));
  const leasedAssetHeaders = ['자산명', '층/세부구역', '임대면적(평)', '월 임대료', '월 관리비', '월 임관리비', '현재 계약만기일', '계약기간'];
  const leasedAssetRows = leasedAssets.map((row) => [
    row.assetName,
    row.spaceLabel,
    formatArea(row.leasedAreaSqm),
    formatCurrency(row.monthlyRentTotal),
    formatCurrency(row.monthlyMfTotal),
    formatCurrency(row.monthlyCostTotal),
    formatDate(row.latestExpiry),
    row.period || '-',
  ]);
  const exposureTableRows = exposureRows.map((row) => [
    row.assetName || row.label,
    formatArea(row.leasedAreaSqm),
    formatCurrency(row.monthlyRentTotal),
    formatCurrency(row.monthlyMfTotal),
    formatCurrency(row.monthlyCostTotal),
  ]);
  const openTableModal = (title, headers, rows) => setModal({ title, headers, rows });
  const refreshOpenDart = async () => {
    const corpCode = firstDefined(profile.company?.dartCorpCode, profile.dartCorpCode, financials.dartCorpCode);
    if (!corpCode) {
      setDartApiStatus({ type: 'blocked', message: 'OpenDART 조회에 필요한 corp_code가 없습니다. DB_기업 매칭값을 먼저 확인해야 합니다.' });
      return;
    }
    setDartApiStatus({ type: 'loading', message: 'OpenDART 서버 함수를 호출하는 중입니다.' });
    try {
      const { data, error } = await supabase.functions.invoke('ll-dashboard-api', {
        body: { action: 'opendart/company', payload: { corp_code: corpCode } },
      });
      if (error) throw error;
      const dart = data?.data || {};
      setDartApiStatus({ type: data?.ok ? 'success' : 'blocked', message: data?.ok ? 'OpenDART server-only 조회 응답을 받았습니다.' : `OpenDART provider 상태 확인 필요: ${data?.provider_status || '-'}` });
      setModal({
        title: 'OpenDART 조회 결과',
        headers: ['항목', '값'],
        rows: [
          ['기업명', dart.corp_name || profile.tenantMasterName || '-'],
          ['corp_code', dart.corp_code || corpCode],
          ['종목명', dart.stock_name || '-'],
          ['종목코드', dart.stock_code || '-'],
          ['대표자', dart.ceo_nm || '-'],
          ['법인구분', dart.corp_cls || '-'],
          ['법인등록번호', dart.jurir_no || '-'],
          ['사업자등록번호', formatBusinessRegistrationNo(dart.bizr_no || profile.businessRegistrationNo, selectedTenantId)],
          ['주소', dart.adres || '-'],
          ['결산월', dart.acc_mt || '-'],
        ],
      });
    } catch (error) {
      setDartApiStatus({ type: 'blocked', message: `OpenDART Edge Function 연결 또는 secret 설정이 필요합니다. (${error.message || 'unknown error'})` });
    }
  };
  const openAssetExposureDetail = (row) => setModal({
    title: `자산 노출 상세 · ${row.assetName || '-'}`,
    headers: ['항목', '내용'],
    rows: [
      ['자산명', row.assetName || '-'],
      ['층/세부구역', row.spaceLabel || '-'],
      ['임대면적(평)', formatArea(row.leasedAreaSqm)],
      ['원본 임대면적(평)', row.leasedAreaPy ? `${formatNumber(row.leasedAreaPy)}평` : '-'],
      ['월 임대료', formatCurrency(row.monthlyRentTotal)],
      ['월 관리비', formatCurrency(row.monthlyMfTotal)],
      ['월 임관리비', formatCurrency(row.monthlyCostTotal)],
      ['현재 계약만기일', formatDate(row.latestExpiry)],
      ['주소', row.address || '-'],
    ],
  });
  const openKpiModal = (item) => {
    if (item.key === 'asset_count') {
      openTableModal('임차 자산 수', ['자산명', '층/세부구역', '임대면적(평)', '월 임관리비', '최근 만기일'], leasedAssets.map((row) => [
        row.assetName,
        row.spaceLabel,
        formatArea(row.leasedAreaSqm),
        formatCurrency(row.monthlyCostTotal),
        formatDate(row.latestExpiry),
      ]));
      return;
    }
    if (['leased_area', 'monthly_total_cost', 'monthly_rent_total', 'monthly_mf_total'].includes(item.key)) {
      openTableModal(item.label, ['자산명', '층/세부구역', '임대면적(평)', '월 임대료', '월 관리비', '월 임관리비', '비율'], leasedAssets.map((row) => {
        const numerator = item.key === 'leased_area'
          ? Number(row.leasedAreaSqm || 0)
          : item.key === 'monthly_rent_total'
            ? Number(row.monthlyRentTotal || 0)
            : item.key === 'monthly_mf_total'
              ? Number(row.monthlyMfTotal || 0)
              : Number(row.monthlyCostTotal || 0);
        const denominator = Number(item.value || 0);
        return [
          row.assetName,
          row.spaceLabel || buildSpaceLabel(row),
          formatArea(row.leasedAreaSqm),
          formatCurrency(row.monthlyRentTotal),
          formatCurrency(row.monthlyMfTotal),
          formatCurrency(row.monthlyCostTotal),
          denominator ? formatPercent(numerator / denominator) : '-',
        ];
      }));
      return;
    }
    openTableModal(item.label, ['항목', '내용'], [['기업명', profile.tenantMasterName || '-'], ['값', formatMetric(item.value, item.valueType)]]);
  };

  return (
    <div className="space-y-6">
      <LogisticsModal modal={modal} onClose={() => setModal(null)} />
      <section className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
        <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-5">
          <div>
            <div className="text-[12px] text-[#86868B] font-semibold">기업 개요</div>
            <h3 className="text-[26px] text-white font-semibold mt-1">{profile.tenantMasterName || '기업'}</h3>
            <p className="text-[13px] text-[#A1A1AA] mt-2">사업자번호 {formatBusinessRegistrationNo(profile.businessRegistrationNo || profile.company?.businessRegistrationNo, selectedTenantId)} · 기준시점 {company.basisDisplay?.asOf || company.generatedAt || '-'} · {financials.dartLinked ? 'DART 연결됨' : 'DART 미연결'}</p>
          </div>
          <select value={selectedTenantId} onChange={(event) => {
            window.sessionStorage.setItem('logisticsSelectedTenantId', event.target.value);
            setSelectedTenantId(event.target.value);
            setDartApiStatus(null);
          }} className="h-10 min-w-[280px] rounded-[8px] border border-[#3A3A3C] bg-[#1F1F1E] px-3 text-[13px] text-white">
            {companyOptionsData.map((item) => <option key={item.tenantId} value={item.tenantId}>{item.tenantMasterName}</option>)}
          </select>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {kpis.map((item) => (
          <button key={item.key || item.label} type="button" onClick={() => openKpiModal(item)} className="text-left rounded-[14px] border border-[#333333] bg-[#252524] px-4 py-4 hover:bg-[#2A2A29]">
            <div className="text-[12px] text-[#86868B] font-semibold">{item.label}</div>
            <div className="text-[21px] text-white font-semibold mt-2">{formatMetric(item.value, item.valueType)}</div>
          </button>
        ))}
      </section>

      <section className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
        <SectionHeader eyebrow="LEASED ASSETS" title="임차 자산 현황" right={<button type="button" onClick={() => openTableModal('임차 자산 현황', leasedAssetHeaders, leasedAssetRows)} className="h-9 px-3 rounded-[8px] bg-[#30302F] text-white text-[13px] font-semibold hover:bg-[#3A3A3A]">원본 표 보기</button>} />
        <DataTable headers={leasedAssetHeaders} rows={leasedAssetRows} onRowClick={(index) => openAssetExposureDetail(leasedAssets[index])} compact />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-[3.5fr_6.5fr] gap-5">
        <div className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
          <SectionHeader
            eyebrow="MAP"
            title="회사별 임차 자산 지도"
            right={<button type="button" onClick={() => setModal({ title: '회사별 임차 자산 지도', size: 'wide', content: <div className="space-y-4"><PortfolioMapPlot points={mapPoints} /><DataTable headers={['자산명', '주소', '좌표']} rows={mapPoints.map((row) => [row.assetName, row.address || '-', `${row.latitude || '-'}, ${row.longitude || '-'}`])} compact /></div> })} className="h-9 px-3 rounded-[8px] bg-white text-[#1F1F1E] text-[13px] font-semibold hover:bg-[#E5E5E5]">지도 크게 보기</button>}
          />
          <PortfolioMapPlot points={mapPoints} />
        </div>
        <div className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
          <SectionHeader
            eyebrow="DART"
            title="DART 상세 정보"
            right={(
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={refreshOpenDart} className="h-9 px-3 rounded-[8px] bg-white text-[#1F1F1E] text-[13px] font-semibold hover:bg-[#E5E5E5]">OpenDART 새로 조회</button>
                <button type="button" onClick={() => openTableModal('DART 상세 정보', ['항목', '값'], companyDartRows(profile, financials))} className="h-9 px-3 rounded-[8px] bg-[#30302F] text-white text-[13px] font-semibold hover:bg-[#3A3A3A]">상세 보기</button>
              </div>
            )}
          />
          <DataTable headers={['항목', '값']} rows={companyDartRows(profile, financials)} compact />
          {dartApiStatus ? (
            <div className={`mt-4 rounded-[12px] border px-4 py-3 text-[12px] leading-5 ${dartApiStatus.type === 'success' ? 'border-[#2E6B45] bg-[#173522] text-[#B5E48C]' : dartApiStatus.type === 'loading' ? 'border-[#34537A] bg-[#202C3D] text-[#9AD7FF]' : 'border-[#7A6425] bg-[#2B2613] text-[#FFD166]'}`}>
              {dartApiStatus.message}
            </div>
          ) : null}
          {financials.emptyStateMessage ? (
            <div className="mt-4 rounded-[12px] border border-[#3A3A3C] bg-[#1F1F1E] p-3 text-[13px] text-[#C7C7CC]">
              DART 상세 정보는 서버 조회 또는 검증된 원본 적재값 기준으로 표시합니다.
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
        <SectionHeader
          eyebrow="EXPOSURE"
          title="자산별 노출도"
          right={(
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setExposureMode('cost')} className={`h-9 px-3 rounded-[8px] text-[13px] font-semibold ${effectiveExposureMode === 'cost' ? 'bg-white text-[#1F1F1E]' : 'bg-[#30302F] text-white hover:bg-[#3A3A3A]'}`}>임관리비 총합 기준</button>
              <button type="button" onClick={() => setExposureMode('area')} className={`h-9 px-3 rounded-[8px] text-[13px] font-semibold ${effectiveExposureMode === 'area' ? 'bg-white text-[#1F1F1E]' : 'bg-[#30302F] text-white hover:bg-[#3A3A3A]'}`}>임대면적 기준</button>
              <button type="button" onClick={() => openTableModal('자산별 노출도', ['자산명', '임대면적(평)', '월 임대료', '월 관리비', '월 임관리비'], exposureTableRows)} className="h-9 px-3 rounded-[8px] bg-[#30302F] text-white text-[13px] font-semibold hover:bg-[#3A3A3A]">원본 표 보기</button>
            </div>
          )}
        />
        <RichBarChart rows={exposureChartRows} labelKey="label" valueKey="value" valueType={effectiveExposureMode === 'area' ? 'area' : 'currency'} valueLabel={effectiveExposureMode === 'area' ? '자산별 임대면적(평)' : '자산별 월 임관리비'} onClick={() => openTableModal('자산별 노출도', ['자산명', '임대면적(평)', '월 임대료', '월 관리비', '월 임관리비'], exposureTableRows)} />
        {!hasCostExposure && exposureMode === 'cost' ? <div className="mt-2 text-[12px] text-[#86868B]">월 임관리비 값이 비어 있어 임대면적 기준으로 표시했습니다.</div> : null}
      </section>
    </div>
  );
}

function AnalysisToolsDashboard() {
  const { memberInfo } = useAuth();
  const permission = useMemo(() => resolveLogisticsPermission(memberInfo), [memberInfo]);
  const readableAssetOptions = useMemo(() => filterAssetsByPermission(assetOptionsData, permission), [permission]);
  const sourceRows = useMemo(() => filterAssetsByPermission(buildLogisticsGeneralRows(), permission), [permission]);
  const readableCompanyOptions = useMemo(() => {
    const grouped = new Map();
    sourceRows.forEach((row) => {
      const tenantId = firstDefined(row.tenantId, row.tenantMasterName);
      const tenantMasterName = cleanDisplay(row.tenantMasterName, '');
      if (!tenantId || !tenantMasterName || tenantMasterName === '-' || grouped.has(tenantId)) return;
      grouped.set(tenantId, {
        tenantId,
        tenantMasterName,
      });
    });
    return [...grouped.values()].sort((a, b) => String(a.tenantMasterName || '').localeCompare(String(b.tenantMasterName || ''), 'ko-KR'));
  }, [sourceRows]);
  const defaultAssetIds = useMemo(() => readableAssetOptions.slice(0, 3).map((item) => item.assetId), [readableAssetOptions]);
  const defaultCompanyIds = useMemo(() => readableCompanyOptions.slice(0, 3).map((item) => item.tenantId), [readableCompanyOptions]);
  const [selectedAssetIds, setSelectedAssetIds] = useState(defaultAssetIds);
  const [selectedCompanyIds, setSelectedCompanyIds] = useState(defaultCompanyIds);
  const [benchmarkMetric, setBenchmarkMetric] = useState('monthlyCostTotal');
  const [modal, setModal] = useState(null);
  const selectedAssetSet = new Set(selectedAssetIds);
  const selectedCompanySet = new Set(selectedCompanyIds);
  const allAnalysisRows = readableAssetOptions.map((assetOption) => normalizeAssetPayload(ASSET_PAYLOADS[assetOption.assetId] || {}))
    .filter((item) => item.overview?.assetName)
    .map((item) => ({
      assetId: item.overview.assetId,
      assetName: item.overview.assetName,
      region: deriveLogisticsRegionFromAddress(item.overview.standardizedAddress, '미분류'),
      monthlyRentTotal: firstDefined(item.overview.monthlyRentTotal, item.overview.monthlyCostTotal),
      monthlyCostTotal: firstDefined(item.overview.monthlyCostTotal, item.overview.monthlyRentTotal),
      vacancyRate: item.overview.vacancyRate,
      leasedAreaSqm: item.overview.leasedAreaSqm,
      grossFloorAreaSqm: item.overview.grossFloorAreaSqm,
      currentRentPerPy: firstDefined(item.overview.currentRentPerPy, item.overview.rentPerPy, calculatePerPy(item.overview.monthlyRentTotal, item.overview.leasedAreaSqm)),
      currentMfPerPy: firstDefined(item.overview.currentMfPerPy, item.overview.mfPerPy, calculatePerPy(item.overview.monthlyMfTotal, item.overview.leasedAreaSqm)),
      averageENoc: item.overview.averageENoc,
      eNoc: item.overview.averageENoc,
    }));
  const rows = allAnalysisRows.filter((row) => selectedAssetSet.has(row.assetId));
  const benchmarkMetricDef = metricDefinition(benchmarkMetric);
  const selectedContracts = sourceRows
    .filter((row) => selectedAssetSet.has(row.assetId) || selectedCompanySet.has(row.tenantId))
    .sort((a, b) => Number(b.monthlyCostTotal || 0) - Number(a.monthlyCostTotal || 0));
  const reviewHighlights = selectedContracts
    .filter((row) => row.calculatedReviewStatus && row.calculatedReviewStatus !== '정상')
    .slice(0, 12);
  const rentValues = rows.map((row) => Number(row.monthlyCostTotal || row.monthlyRentTotal || 0)).filter((value) => value > 0);
  const rentSpread = rentValues.length ? Math.max(...rentValues) - Math.min(...rentValues) : 0;
  const metricRankRows = allAnalysisRows
    .map((row) => ({ ...row, metricValue: Number(metricValueFromRow(row, benchmarkMetric) || 0) }))
    .filter((row) => row.metricValue > 0)
    .sort((a, b) => b.metricValue - a.metricValue);
  const portfolioMetricValues = metricRankRows.map((row) => row.metricValue);
  const portfolioAverage = portfolioMetricValues.length ? portfolioMetricValues.reduce((sum, value) => sum + value, 0) / portfolioMetricValues.length : 0;
  const selectedMetricValues = rows.map((row) => Number(metricValueFromRow(row, benchmarkMetric) || 0)).filter((value) => value > 0);
  const selectedAverage = selectedMetricValues.length ? selectedMetricValues.reduce((sum, value) => sum + value, 0) / selectedMetricValues.length : 0;
  const metricRankByAssetId = new Map(metricRankRows.map((row, index) => [row.assetId, index + 1]));
  const tableRows = rows.map((row) => [
    row.assetName,
    row.region,
    formatArea(row.grossFloorAreaSqm),
    formatArea(row.leasedAreaSqm),
    formatPercent(row.vacancyRate),
    formatMetric(metricValueFromRow(row, benchmarkMetric), benchmarkMetricDef.type),
    portfolioAverage ? formatMetric(Number(metricValueFromRow(row, benchmarkMetric) || 0) - portfolioAverage, benchmarkMetricDef.type) : '-',
    metricRankByAssetId.get(row.assetId) ? `${formatNumber(metricRankByAssetId.get(row.assetId))}/${formatNumber(metricRankRows.length)}` : '-',
    formatWon(row.averageENoc),
  ]);
  const contractRows = selectedContracts.slice(0, 80).map((row) => [
    row.assetName,
    row.tenantMasterName,
    row.spaceLabel,
    formatArea(row.leasedAreaSqm),
    formatCurrency(row.currentMonthlyRentTotal),
    formatCurrency(row.currentMonthlyMfTotal),
    formatCurrency(row.monthlyCostTotal),
    row.currentEndDate || '-',
    row.calculatedReviewStatus,
  ]);
  const selectedCompanyRows = selectedContracts.filter((row) => selectedCompanySet.has(row.tenantId));
  const companyCompareRows = buildTenantContractGroups(selectedCompanyRows.length ? selectedCompanyRows : selectedContracts)
    .filter((row) => selectedCompanySet.size === 0 || selectedCompanySet.has(row.key))
    .map((row) => ({
      ...row,
      metricValue: benchmarkMetric === 'count'
        ? row.rowCount
        : benchmarkMetric === 'leasedAreaSqm'
          ? row.leasedAreaSqm
          : benchmarkMetric === 'currentMonthlyRentTotal'
            ? row.monthlyRentTotal
            : benchmarkMetric === 'currentMonthlyMfTotal'
              ? row.monthlyMfTotal
              : benchmarkMetric === 'currentRentPerPy'
                ? row.rentPerPy
                : benchmarkMetric === 'currentMfPerPy'
                  ? row.mfPerPy
                  : benchmarkMetric === 'eNoc'
                    ? row.costPerPy
                    : row.monthlyCostTotal,
    }));
  const companyTableRows = companyCompareRows.map((row) => [
    row.tenantMasterName,
    row.assetNames.join(', '),
    formatNumber(row.rowCount),
    formatArea(row.leasedAreaSqm),
    formatCurrency(row.monthlyRentTotal),
    formatCurrency(row.monthlyMfTotal),
    formatCurrency(row.monthlyCostTotal),
    formatMetric(row.metricValue, benchmarkMetricDef.type),
  ]);
  const toggleValue = (value, values, setter) => {
    setter(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  };
  const openAnalysisAssetDetail = (assetRow) => {
    const assetContracts = selectedContracts.filter((row) => row.assetId === assetRow.assetId || row.assetName === assetRow.assetName);
    setModal({
      title: `분석 원장 · ${assetRow.assetName}`,
      size: 'wide',
      content: (
        <div className="space-y-4">
          <DataTable
            headers={['항목', '값']}
            rows={[
              ['자산명', assetRow.assetName],
              ['권역', assetRow.region],
              ['비교 지표', benchmarkMetricDef.label],
              ['선택 자산 값', formatMetric(metricValueFromRow(assetRow, benchmarkMetric), benchmarkMetricDef.type)],
              ['포트폴리오 평균', formatMetric(portfolioAverage, benchmarkMetricDef.type)],
              ['평균 대비', portfolioAverage ? formatMetric(Number(metricValueFromRow(assetRow, benchmarkMetric) || 0) - portfolioAverage, benchmarkMetricDef.type) : '-'],
              ['순위', metricRankByAssetId.get(assetRow.assetId) ? `${formatNumber(metricRankByAssetId.get(assetRow.assetId))}/${formatNumber(metricRankRows.length)}` : '-'],
            ]}
            compact
          />
          <DataTable headers={['자산', '임차인', '구역', '임대면적(평)', '월 임대료', '월 관리비', '월 임관리비', '만기', '검토 상태']} rows={assetContracts.map((row) => [
            row.assetName,
            row.tenantMasterName,
            row.spaceLabel,
            formatArea(row.leasedAreaSqm),
            formatCurrency(row.currentMonthlyRentTotal),
            formatCurrency(row.currentMonthlyMfTotal),
            formatCurrency(row.monthlyCostTotal),
            row.currentEndDate || '-',
            row.calculatedReviewStatus,
          ])} compact />
        </div>
      ),
    });
  };

  return (
    <div className="space-y-6">
      <LogisticsModal modal={modal} onClose={() => setModal(null)} />
      <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
          <SectionHeader
            eyebrow="ASSET COMPARISON"
            title="자산 비교"
            right={<button type="button" onClick={() => setModal({ title: '자산 비교 원본 표', headers: ['자산명', '권역', '연면적(평)', '임대면적(평)', '공실률', benchmarkMetricDef.label, '평균 E.NOC'], rows: tableRows })} className="h-9 cursor-pointer rounded-[8px] bg-[#30302F] px-3 text-[13px] font-semibold text-white hover:bg-[#3A3A3A]">원본 표 보기</button>}
          />
          <label className="mb-4 grid grid-cols-1 items-center gap-3 rounded-[14px] border border-[#333333] bg-[#1F1F1E] p-3 md:grid-cols-[92px_minmax(0,1fr)]">
            <span className="text-[12px] font-bold text-[#86868B]">비교 지표</span>
            <select value={benchmarkMetric} onChange={(event) => setBenchmarkMetric(event.target.value)} className="h-10 rounded-[8px] border border-[#3A3A3C] bg-[#252524] px-3 text-[13px] font-semibold text-white">
              {PLAYGROUND_METRICS.filter((item) => ANALYSIS_METRIC_KEYS.includes(item.key)).map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
            </select>
          </label>
          <div className="mb-4 rounded-[14px] border border-[#333333] bg-[#1F1F1E] p-3">
            <div className="mb-2 text-[12px] font-semibold text-[#86868B]">자산 선택</div>
            <div className="custom-scrollbar grid max-h-[210px] grid-cols-1 gap-2 overflow-auto md:grid-cols-2">
              {readableAssetOptions.map((item) => (
                <button key={item.assetId} type="button" onClick={() => toggleValue(item.assetId, selectedAssetIds, setSelectedAssetIds)} className={`cursor-pointer rounded-[8px] border px-3 py-2 text-left text-[12px] font-semibold ${selectedAssetIds.includes(item.assetId) ? 'border-white bg-white text-[#1F1F1E]' : 'border-[#3A3A3C] bg-[#252524] text-[#A1A1AA] hover:text-white'}`}>
                  {item.assetName}
                </button>
              ))}
            </div>
          </div>
          <div className="mb-4 grid grid-cols-3 gap-2">
            {[
              ['선택 자산', `${formatNumber(selectedAssetIds.length)}개`],
              ['선택 평균', formatMetric(selectedAverage, benchmarkMetricDef.type)],
              ['전체 평균', formatMetric(portfolioAverage, benchmarkMetricDef.type)],
            ].map(([label, value]) => (
              <button key={label} type="button" onClick={() => setModal({ title: '자산 비교 원본 표', headers: ['자산명', '권역', '연면적(평)', '임대면적(평)', '공실률', benchmarkMetricDef.label, '평균 E.NOC'], rows: tableRows })} className="cursor-pointer rounded-[12px] border border-[#333333] bg-[#1F1F1E] p-3 text-left hover:bg-[#2A2A29]">
                <div className="text-[11px] font-semibold text-[#86868B]">{label}</div>
                <div className="mt-2 text-[17px] font-bold text-white">{value}</div>
              </button>
            ))}
          </div>
          <RichBarChart rows={rows.map((row) => ({ ...row, value: metricValueFromRow(row, benchmarkMetric) }))} labelKey="assetName" valueKey="value" valueType={benchmarkMetricDef.type} valueLabel={benchmarkMetricDef.label} onClick={() => setModal({ title: '자산 비교', headers: ['자산명', benchmarkMetricDef.label, '공실률', '임대면적(평)', '월 임관리비'], rows: rows.map((row) => [row.assetName, formatMetric(metricValueFromRow(row, benchmarkMetric), benchmarkMetricDef.type), formatPercent(row.vacancyRate), formatArea(row.leasedAreaSqm), formatCurrency(row.monthlyCostTotal)]) })} />
        </div>

        <div className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
          <SectionHeader
            eyebrow="COMPANY COMPARISON"
            title="기업 비교"
            right={<button type="button" onClick={() => setModal({ title: '기업 비교 원본 표', headers: ['기업명', '자산 목록', '계약 수', '임대면적(평)', '월 임대료', '월 관리비', '월 임관리비', benchmarkMetricDef.label], rows: companyTableRows })} className="h-9 cursor-pointer rounded-[8px] bg-[#30302F] px-3 text-[13px] font-semibold text-white hover:bg-[#3A3A3A]">원본 표 보기</button>}
          />
          <label className="mb-4 grid grid-cols-1 items-center gap-3 rounded-[14px] border border-[#333333] bg-[#1F1F1E] p-3 md:grid-cols-[92px_minmax(0,1fr)]">
            <span className="text-[12px] font-bold text-[#86868B]">비교 지표</span>
            <select value={benchmarkMetric} onChange={(event) => setBenchmarkMetric(event.target.value)} className="h-10 rounded-[8px] border border-[#3A3A3C] bg-[#252524] px-3 text-[13px] font-semibold text-white">
              {PLAYGROUND_METRICS.filter((item) => ANALYSIS_METRIC_KEYS.includes(item.key)).map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
            </select>
          </label>
          <div className="mb-4 rounded-[14px] border border-[#333333] bg-[#1F1F1E] p-3">
            <div className="mb-2 text-[12px] font-semibold text-[#86868B]">기업 선택</div>
            <div className="custom-scrollbar grid max-h-[210px] grid-cols-1 gap-2 overflow-auto md:grid-cols-2">
              {readableCompanyOptions.map((item) => (
                <button key={item.tenantId} type="button" onClick={() => toggleValue(item.tenantId, selectedCompanyIds, setSelectedCompanyIds)} className={`cursor-pointer rounded-[8px] border px-3 py-2 text-left text-[12px] font-semibold ${selectedCompanyIds.includes(item.tenantId) ? 'border-white bg-white text-[#1F1F1E]' : 'border-[#3A3A3C] bg-[#252524] text-[#A1A1AA] hover:text-white'}`}>
                  {item.tenantMasterName}
                </button>
              ))}
            </div>
          </div>
          <div className="mb-4 grid grid-cols-3 gap-2">
            {[
              ['선택 기업', `${formatNumber(selectedCompanyIds.length)}개`],
              ['계약 원장', `${formatNumber(selectedContracts.length)}건`],
              ['임관리비 spread', formatCurrency(rentSpread)],
            ].map(([label, value]) => (
              <button key={label} type="button" onClick={() => setModal({ title: '계약 원장', headers: ['자산', '임차인', '구역', '임대면적(평)', '월 임대료', '월 관리비', '월 임관리비', '만기', '검토 상태'], rows: contractRows })} className="cursor-pointer rounded-[12px] border border-[#333333] bg-[#1F1F1E] p-3 text-left hover:bg-[#2A2A29]">
                <div className="text-[11px] font-semibold text-[#86868B]">{label}</div>
                <div className="mt-2 text-[17px] font-bold text-white">{value}</div>
              </button>
            ))}
          </div>
          <RichBarChart rows={companyCompareRows} labelKey="tenantMasterName" valueKey="metricValue" valueType={benchmarkMetricDef.type} valueLabel={benchmarkMetricDef.label} onClick={() => setModal({ title: '기업 비교', headers: ['기업명', '자산 목록', '계약 수', '임대면적(평)', '월 임대료', '월 관리비', '월 임관리비', benchmarkMetricDef.label], rows: companyTableRows })} />
        </div>
      </section>
      <section className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
        <SectionHeader eyebrow="MATRIX" title="벤치마크 매트릭스" />
        <DataTable headers={['자산명', '권역', '연면적(평)', '임대면적(평)', '공실률', benchmarkMetricDef.label, '전체 평균 대비', '순위', '평균 E.NOC']} rows={tableRows} onRowClick={(index) => openAnalysisAssetDetail(rows[index])} compact />
      </section>
      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_360px]">
        <div className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
          <SectionHeader eyebrow="LEDGER" title="선택 계약 원장" right={<button type="button" onClick={() => setModal({ title: '계약 원장', headers: ['자산', '임차인', '구역', '임대면적(평)', '월 임대료', '월 관리비', '월 임관리비', '만기', '검토 상태'], rows: contractRows })} className="h-9 cursor-pointer rounded-[8px] bg-[#30302F] px-3 text-[13px] font-semibold text-white hover:bg-[#3A3A3A]">전체 보기</button>} />
          <DataTable headers={['자산', '임차인', '구역', '임대면적(평)', '월 임관리비', '만기']} rows={selectedContracts.slice(0, 12).map((row) => [row.assetName, row.tenantMasterName, row.spaceLabel, formatArea(row.leasedAreaSqm), formatCurrency(row.monthlyCostTotal), row.currentEndDate || '-'])} compact />
        </div>
        <div className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
          <SectionHeader eyebrow="REVIEW" title="검토 필요 항목" />
          <div className="space-y-2">
            {reviewHighlights.length ? reviewHighlights.map((row, index) => (
              <button key={`${row.assetName}-${row.tenantMasterName}-${index}`} type="button" onClick={() => setModal({ title: '검토 항목 상세', headers: ['항목', '내용'], rows: [['자산', row.assetName], ['임차인', row.tenantMasterName], ['구역', row.spaceLabel], ['검토 상태', row.calculatedReviewStatus], ['월 임관리비', formatCurrency(row.monthlyCostTotal)]] })} className="w-full cursor-pointer rounded-[12px] border border-[#333333] bg-[#1F1F1E] p-3 text-left hover:bg-[#2A2A29]">
                <div className="text-[13px] font-semibold text-white">{row.assetName}</div>
                <div className="mt-1 text-[12px] text-[#86868B]">{row.tenantMasterName} · {row.calculatedReviewStatus}</div>
              </button>
            )) : <div className="rounded-[12px] border border-[#333333] bg-[#1F1F1E] p-4 text-[13px] text-[#86868B]">선택 범위 내 검토 필요 항목이 없습니다.</div>}
          </div>
        </div>
      </section>
    </div>
  );
}

function DataPlaygroundDashboard() {
  const { memberInfo } = useAuth();
  const permission = useMemo(() => resolveLogisticsPermission(memberInfo), [memberInfo]);
  const [mode, setMode] = useState('sandbox');
  const [sourceBasis, setSourceBasis] = useState('current');
  const [dimension, setDimension] = useState('assetName');
  const [columnDimension, setColumnDimension] = useState('none');
  const [filterDimension, setFilterDimension] = useState('');
  const [filterValue, setFilterValue] = useState('');
  const [metric, setMetric] = useState('monthlyCostTotal');
  const [secondaryMetric, setSecondaryMetric] = useState('leasedAreaSqm');
  const [aggregation, setAggregation] = useState('sum');
  const [topN, setTopN] = useState(15);
  const [excludeBlank, setExcludeBlank] = useState(true);
  const [modal, setModal] = useState(null);
  const sourceRows = useMemo(() => filterAssetsByPermission(buildLogisticsGeneralRows(), permission), [permission]);
  const metricDef = metricDefinition(metric);
  const secondaryMetricDef = metricDefinition(secondaryMetric);
  const activeMode = PLAYGROUND_MODES.find((item) => item.id === mode) || PLAYGROUND_MODES[0];
  const basisLabel = sourceBasis === 'history' ? 'DB_히스토리 누적 기준' : 'DB_일반 현재값 기준';
  const filterOptions = useMemo(() => {
    if (!filterDimension) return [];
    const grouped = sourceRows.reduce((acc, row) => {
      const key = cleanDisplay(row[filterDimension], '미분류');
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(grouped)
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => Number(b.count || 0) - Number(a.count || 0))
      .slice(0, 60);
  }, [filterDimension, sourceRows]);
  const pivot = useMemo(() => buildPivotRows(sourceRows, {
    rowDimension: dimension,
    columnDimension,
    metric,
    aggregation,
    filterDimension,
    filterValue,
    topN,
    excludeBlank,
  }), [aggregation, columnDimension, dimension, excludeBlank, filterDimension, filterValue, metric, sourceRows, topN]);
  const secondaryPivot = useMemo(() => buildPivotRows(sourceRows, {
    rowDimension: dimension,
    columnDimension,
    metric: secondaryMetric,
    aggregation,
    filterDimension,
    filterValue,
    topN,
    excludeBlank,
  }), [aggregation, columnDimension, dimension, excludeBlank, filterDimension, filterValue, secondaryMetric, sourceRows, topN]);
  const rowDimensionLabel = PLAYGROUND_DIMENSIONS.find((item) => item.key === dimension)?.label || '행';
  const columnDimensionLabel = columnDimension === 'none' ? '합계' : PLAYGROUND_DIMENSIONS.find((item) => item.key === columnDimension)?.label || '열';
  const aggregationLabel = PLAYGROUND_AGGREGATIONS.find((item) => item.key === aggregation)?.label || '합계';
  const tableHeaders = [rowDimensionLabel, ...pivot.columns, '총계', '원본 행'];
  const tableRows = pivot.rows.map((row) => [
    row.label,
    ...pivot.columns.map((column) => formatMetric(row.cells[column], metricDef.type)),
    formatMetric(row.total, metricDef.type),
    `${formatNumber(row.recordCount)}건`,
  ]);
  const detailRows = (row) => row.sourceRows.slice(0, 80).map((item) => [
    item.assetName,
    item.tenantMasterName,
    item.fundName,
    formatArea(item.leasedAreaSqm),
    formatCurrency(item.currentMonthlyRentTotal),
    formatCurrency(item.currentMonthlyMfTotal),
    formatCurrency(item.monthlyCostTotal),
    item.currentEndDate || '-',
  ]);
  const applySavedView = (view) => {
    setDimension(view.dimension);
    setMetric(view.metric);
    setSecondaryMetric(view.secondaryMetric || 'leasedAreaSqm');
    setTopN(view.topN);
    setColumnDimension(view.columnDimension || 'none');
    setFilterDimension(view.filterDimension || '');
    setFilterValue(view.filterValue || '');
  };
  const summaryRows = pivot.rows.map((row) => {
    const secondary = secondaryPivot.rows.find((item) => item.key === row.key);
    return [
      row.label,
      formatMetric(row.total, metricDef.type),
      formatMetric(secondary?.total || 0, secondaryMetricDef.type),
      `${formatNumber(row.recordCount)}건`,
    ];
  });
  const explorerRows = pivot.filteredRows.slice(0, 80).map((row) => [
    row.assetName,
    row.tenantMasterName,
    row.fundName,
    row.region,
    row.goodsType,
    row.coldStorageType,
    formatArea(row.grossFloorAreaSqm),
    formatArea(row.leasedAreaSqm),
    formatCurrency(row.currentMonthlyRentTotal),
    formatCurrency(row.currentMonthlyMfTotal),
    formatCurrency(row.monthlyCostTotal),
    formatWon(firstDefined(row.eNoc, row.averageENoc, row.currentENoc, row.currentENocPerPy)),
    row.currentEndDate || '-',
  ]);

  return (
    <div className="space-y-6">
      <LogisticsModal modal={modal} onClose={() => setModal(null)} />
      <section className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
        <SectionHeader
          eyebrow="DATA PLAYGROUND"
          title="피벗테이블"
          right={<button type="button" onClick={() => setModal({ title: 'Data Playground 피벗 결과', size: 'wide', headers: tableHeaders, rows: tableRows })} className="h-9 cursor-pointer rounded-[8px] bg-[#30302F] px-3 text-[13px] font-semibold text-white hover:bg-[#3A3A3A]">피벗 결과 크게 보기</button>}
        />
        <div className="mb-5 flex flex-wrap items-center gap-2">
          {PLAYGROUND_MODES.map((item) => (
            <button key={item.id} type="button" onClick={() => setMode(item.id)} className={`h-9 cursor-pointer rounded-[8px] border px-3 text-[12px] font-semibold ${mode === item.id ? 'border-white bg-white text-[#1F1F1E]' : 'border-[#3A3A3C] bg-[#1F1F1E] text-[#A1A1AA] hover:text-white'}`}>
              {item.label}
            </button>
          ))}
          <select value={sourceBasis} onChange={(event) => setSourceBasis(event.target.value)} className="h-9 rounded-[8px] border border-[#3A3A3C] bg-[#1F1F1E] px-3 text-[12px] font-semibold text-white">
            <option value="current">DB_일반 현재값</option>
            <option value="history">DB_히스토리 누적</option>
          </select>
          <label className="ml-auto flex h-9 items-center gap-2 rounded-[8px] border border-[#3A3A3C] bg-[#1F1F1E] px-3 text-[12px] font-semibold text-[#D1D1D6]">
            <input type="checkbox" checked={excludeBlank} onChange={(event) => setExcludeBlank(event.target.checked)} />
            빈값 제외
          </label>
        </div>
        <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-7">
          <label className="block">
            <span className="mb-2 block text-[12px] font-semibold text-[#86868B]">행 필드</span>
            <select value={dimension} onChange={(event) => setDimension(event.target.value)} className="h-10 w-full rounded-[8px] border border-[#3A3A3C] bg-[#1F1F1E] px-3 text-[13px] text-white">
              {PLAYGROUND_DIMENSIONS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-[12px] font-semibold text-[#86868B]">열 필드</span>
            <select value={columnDimension} onChange={(event) => setColumnDimension(event.target.value)} className="h-10 w-full rounded-[8px] border border-[#3A3A3C] bg-[#1F1F1E] px-3 text-[13px] text-white">
              <option value="none">사용 안 함</option>
              {PLAYGROUND_DIMENSIONS.filter((item) => item.key !== dimension).map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-[12px] font-semibold text-[#86868B]">값 필드</span>
            <select value={metric} onChange={(event) => setMetric(event.target.value)} className="h-10 w-full rounded-[8px] border border-[#3A3A3C] bg-[#1F1F1E] px-3 text-[13px] text-white">
              {PLAYGROUND_METRICS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-[12px] font-semibold text-[#86868B]">보조 값</span>
            <select value={secondaryMetric} onChange={(event) => setSecondaryMetric(event.target.value)} className="h-10 w-full rounded-[8px] border border-[#3A3A3C] bg-[#1F1F1E] px-3 text-[13px] text-white">
              {PLAYGROUND_METRICS.filter((item) => item.key !== metric).map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-[12px] font-semibold text-[#86868B]">집계 방식</span>
            <select value={aggregation} onChange={(event) => setAggregation(event.target.value)} className="h-10 w-full rounded-[8px] border border-[#3A3A3C] bg-[#1F1F1E] px-3 text-[13px] text-white">
              {PLAYGROUND_AGGREGATIONS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-[12px] font-semibold text-[#86868B]">필터</span>
            <select value={filterDimension} onChange={(event) => { setFilterDimension(event.target.value); setFilterValue(''); }} className="h-10 w-full rounded-[8px] border border-[#3A3A3C] bg-[#1F1F1E] px-3 text-[13px] text-white">
              <option value="">전체</option>
              {PLAYGROUND_DIMENSIONS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-[12px] font-semibold text-[#86868B]">Top N</span>
            <select value={topN} onChange={(event) => setTopN(Number(event.target.value))} className="h-10 w-full rounded-[8px] border border-[#3A3A3C] bg-[#1F1F1E] px-3 text-[13px] text-white">
              {[5, 10, 15, 25, 50].map((value) => <option key={value} value={value}>Top {value}</option>)}
            </select>
          </label>
        </div>
        {filterDimension ? (
          <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-[1fr_2fr]">
            <label className="block">
              <span className="mb-2 block text-[12px] font-semibold text-[#86868B]">필터 값</span>
              <select value={filterValue} onChange={(event) => setFilterValue(event.target.value)} className="h-10 w-full rounded-[8px] border border-[#3A3A3C] bg-[#1F1F1E] px-3 text-[13px] text-white">
                <option value="">전체</option>
                {filterOptions.map((item) => <option key={item.value} value={item.value}>{item.value} · {formatNumber(item.count)}건</option>)}
              </select>
            </label>
            <div>
              <span className="mb-2 block text-[12px] font-semibold text-[#86868B]">저장된 보기</span>
              <div className="flex flex-wrap gap-2">
                {PLAYGROUND_SAVED_VIEWS.map((view) => <button key={view.key} type="button" onClick={() => applySavedView(view)} className="h-10 cursor-pointer rounded-[8px] border border-[#3A3A3C] bg-[#1F1F1E] px-3 text-[12px] font-semibold text-[#A1A1AA] hover:bg-[#30302F] hover:text-white">{view.label}</button>)}
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-5">
            <span className="mb-2 block text-[12px] font-semibold text-[#86868B]">저장된 보기</span>
            <div className="flex flex-wrap gap-2">
              {PLAYGROUND_SAVED_VIEWS.map((view) => <button key={view.key} type="button" onClick={() => applySavedView(view)} className="h-10 cursor-pointer rounded-[8px] border border-[#3A3A3C] bg-[#1F1F1E] px-3 text-[12px] font-semibold text-[#A1A1AA] hover:bg-[#30302F] hover:text-white">{view.label}</button>)}
            </div>
          </div>
        )}
        <div className="text-[12px] leading-5 text-[#86868B]">{activeMode.title} · {basisLabel} · 행: {rowDimensionLabel} · 열: {columnDimensionLabel} · 값: {aggregationLabel} {metricDef.label} · 보조 값: {secondaryMetricDef.label} · 권한 자산 기준 {formatNumber(pivot.filteredRows.length)}행</div>
      </section>
      <section className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
        <SectionHeader eyebrow="PIVOT VALUES" title="다중 값 요약" />
        <DataTable headers={[rowDimensionLabel, `${aggregationLabel} ${metricDef.label}`, `${aggregationLabel} ${secondaryMetricDef.label}`, '원본 행']} rows={summaryRows} compact />
      </section>
      <section className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
        <SectionHeader eyebrow="PIVOT RESULT" title="피벗 결과 테이블" />
        <div className="custom-scrollbar overflow-auto rounded-[10px] border border-[#333333]">
          <table className="table-fixed border-collapse text-left text-[12px]" style={{ minWidth: `${Math.max(760, 180 + pivot.columns.length * 120 + 210)}px` }}>
            <colgroup>
              <col style={{ width: 180 }} />
              {pivot.columns.map((column) => <col key={`col-${column}`} style={{ width: 120 }} />)}
              <col style={{ width: 110 }} />
              <col style={{ width: 100 }} />
            </colgroup>
            <thead className="sticky top-0 z-20 bg-[#1F1F1E] text-[#86868B]">
              <tr>
                {tableHeaders.map((header, index) => (
                  <th key={header} className={`border-b border-[#333333] px-3 py-2 font-semibold ${index === 0 ? 'sticky left-0 z-30 w-[180px] bg-[#1F1F1E]' : 'whitespace-nowrap text-right'}`}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pivot.rows.map((row) => {
                const cells = [
                  row.label,
                  ...pivot.columns.map((column) => formatMetric(row.cells[column], metricDef.type)),
                  formatMetric(row.total, metricDef.type),
                  `${formatNumber(row.recordCount)}건`,
                ];
                return (
                  <tr key={row.key} onClick={() => setModal({ title: `${row.label} 원본 drilldown`, size: 'wide', headers: ['자산', '임차인', '펀드', '임대면적(평)', '월 임대료', '월 관리비', '월 임관리비', '만기'], rows: detailRows(row) })} className="cursor-pointer border-b border-[#333333] last:border-b-0 hover:bg-white/[0.04]">
                    {cells.map((cell, index) => (
                      <td key={`${row.key}-${index}`} className={`px-3 py-2 align-top text-[#E5E5E5] ${index === 0 ? 'sticky left-0 z-10 w-[180px] max-w-[180px] bg-[#252524] font-semibold text-left' : 'whitespace-nowrap text-right tabular-nums'}`}>
                        <span className={index === 0 ? 'block truncate' : ''} title={typeof cell === 'string' ? cell : undefined}>{cell}</span>
                      </td>
                    ))}
                  </tr>
                );
              })}
              {pivot.rows.length ? (
                <tr className="bg-[#1F1F1E] font-semibold text-white">
                  <td className="sticky left-0 z-10 w-[180px] max-w-[180px] bg-[#1F1F1E] px-3 py-2">총계</td>
                  {pivot.columns.map((column) => (
                    <td key={`total-${column}`} className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{formatMetric(aggregateMetricValues(pivot.filteredRows.filter((row) => (columnDimension === 'none' ? true : cleanDisplay(row[columnDimension], '미분류') === column)), metric, aggregation), metricDef.type)}</td>
                  ))}
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{formatMetric(pivot.grandTotal, metricDef.type)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{formatNumber(pivot.filteredRows.length)}건</td>
                </tr>
              ) : null}
            </tbody>
          </table>
          {!pivot.rows.length ? <div className="p-5 text-[13px] text-[#86868B]">선택한 피벗 조건에 해당하는 데이터가 없습니다.</div> : null}
        </div>
      </section>
      <section className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
        <SectionHeader eyebrow="PIVOT CHART" title="피벗 결과 차트" />
        <RichBarChart rows={pivot.rows.map((row) => ({
          ...row,
          label: row.label,
          value: row.total,
          tooltipLines: [
            ['원본 행', `${formatNumber(row.recordCount)}건`],
            ['집계', `${aggregationLabel} ${metricDef.label}`],
          ],
        }))} labelKey="label" valueKey="value" valueType={metricDef.type} valueLabel={`${aggregationLabel} ${metricDef.label}`} onClick={() => setModal({ title: 'Data Playground 차트 상세', size: 'wide', headers: tableHeaders, rows: tableRows })} />
      </section>
      {mode === 'explorer' ? (
        <section className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
          <SectionHeader eyebrow="EXPLORER" title="원본 레코드 미리보기" />
          <DataTable
            headers={['자산', '임차인', '펀드', '권역', '물류 유형', '저온 유형', '연면적(평)', '임대면적(평)', '월 임대료', '월 관리비', '월 임관리비', 'E.NOC', '만기']}
            rows={explorerRows}
            compact
          />
        </section>
      ) : null}
      {mode === 'workspace' ? (
        <section className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
          <SectionHeader eyebrow="BI WORKSPACE" title="피벗 설정 감사" />
          <DataTable
            headers={['항목', '현재 설정']}
            rows={[
              ['데이터 기준', basisLabel],
              ['행 필드', rowDimensionLabel],
              ['열 필드', columnDimensionLabel],
              ['값 필드', `${aggregationLabel} ${metricDef.label}`],
              ['보조 값', `${aggregationLabel} ${secondaryMetricDef.label}`],
              ['필터', filterDimension ? `${PLAYGROUND_DIMENSIONS.find((item) => item.key === filterDimension)?.label || filterDimension} = ${filterValue || '전체'}` : '전체'],
              ['표시 행', `Top ${formatNumber(topN)}`],
              ['권한 반영 행', `${formatNumber(pivot.filteredRows.length)}행`],
            ]}
            compact
          />
        </section>
      ) : null}
    </div>
  );
}

function buildDataQualityFindings() {
  const findings = [];
  assetOptionsData.forEach((asset) => {
    if (asset.monthlyCostTotal == null) findings.push({ severity: 'warning', sheetName: 'DB_히스토리 누적', targetType: 'asset', target: asset.assetName, field: 'monthlyCostTotal', reason: 'mapping_missing', action: '월 임관리비 매핑 확인' });
    if (asset.vacancyRate == null) findings.push({ severity: 'warning', sheetName: 'DB_자산', targetType: 'asset', target: asset.assetName, field: 'vacancyRate', reason: 'mapping_missing', action: '공실률 계산 근거 확인' });
  });
  Object.values(ASSET_PAYLOADS).forEach((payload) => {
    const normalized = normalizeAssetPayload(payload);
    const overview = normalized.overview || {};
    const rows = normalized.normalizedRows || [];
    const assetName = overview.assetName || payload.meta?.selection?.assetName || '-';
    const hasLeasedRows = rows.some((row) => Number(row.leasedAreaSqm || 0) > 0);
    const weightedENoc = calculateWeightedENoc(rows, overview.averageENoc);
    const useRows = buildUseCategoryRows(payload);
    const storageArea = Number(useRows.find((row) => row.label === '저온창고')?.value || 0)
      + Number(useRows.find((row) => row.label === '상온창고')?.value || 0);
    if (hasLeasedRows && !weightedENoc) {
      findings.push({
        severity: 'critical',
        sheetName: 'DB_히스토리누적',
        targetType: 'asset',
        target: assetName,
        field: 'averageENoc',
        reason: rows.some((row) => row.currentMoneyStatus === 'history_unmatched') ? 'history_unmatched' : 'money_missing',
        action: '임차 행은 있으나 최신 임대료/관리비 history가 연결되지 않아 E.NOC를 계산할 수 없습니다. DB_히스토리누적 연결키를 확인하세요.',
      });
    }
    if (hasLeasedRows && storageArea <= 0) {
      findings.push({
        severity: 'warning',
        sheetName: 'DB_일반',
        targetType: 'asset',
        target: assetName,
        field: 'coldRatio',
        reason: 'storage_area_missing',
        action: '저온/상온 구분은 있으나 면적 기준이 없어 저온창고 비율 산식 적용이 필요합니다.',
      });
    }
  });
  companyOptionsData.forEach((company) => {
    if (!company.exposureAvailable) findings.push({ severity: 'info', sheetName: 'DB_일반', targetType: 'company', target: company.tenantMasterName, field: 'exposureAvailable', reason: 'relation_unmatched', action: '임차 자산 연결 확인' });
    if (!company.latestRevenue) findings.push({ severity: 'critical', sheetName: 'DB_기업', targetType: 'company', target: company.tenantMasterName, field: 'OpenDART/latestRevenue', reason: 'source_error', action: 'OpenDART 적재 상태 확인' });
  });
  (weeklyReportData.assetRows || []).forEach((row) => {
    if (!resolveAssetIdByName(row.assetName)) findings.push({ severity: 'warning', sheetName: 'Weekly', targetType: 'weekly_asset', target: row.assetName, field: 'assetName', reason: 'relation_unmatched', action: '자산 마스터 매칭 확인' });
    if (!row.mainIssue) findings.push({ severity: 'info', sheetName: 'Weekly', targetType: 'weekly_asset', target: row.assetName, field: 'mainIssue', reason: 'original_blank', action: '주간 이슈 입력 확인' });
  });
  return findings;
}

function normalizeRemoteQualityFinding(row, index) {
  return {
    id: row.id || row.finding_id || `remote-${index}`,
    severity: String(row.severity || row.level || row.status || 'warning').toLowerCase(),
    sheetName: row.sheet_name || row.sheetName || row.source_sheet || row.table_name || row.target_table || 'll_data_quality_findings',
    targetType: row.target_type || row.entity_type || row.table_name || 'finding',
    target: row.target_name || row.asset_name || row.tenant_master_name || row.entity_id || row.row_ref || row.id || '-',
    field: row.field_name || row.field || row.column_name || row.rule_name || '-',
    reason: row.reason_code || row.failure_reason || row.issue_type || row.reason || row.status || 'unknown',
    action: row.suggested_fix || row.action || row.message || row.detail || '원본 값과 정규화 결과 대조 필요',
    sourceTable: 'public.ll_data_quality_findings',
    raw: row,
  };
}

function normalizeRemoteEditRequest(row, index) {
  const payload = parseJsonObject(row.request_payload);
  const cells = Array.isArray(payload.cell_edits) ? payload.cell_edits : parseJsonArray(row.requested_value);
  const displayRequestedValue = cells.length ? `${formatNumber(cells.length)}개 셀 수정` : cleanDisplay(row.requested_value || (cells[0]?.afterValue ?? cells[0]?.after_value ?? ''));
  return {
    id: row.id || `edit-${index}`,
    status: row.status || 'submitted',
    targetType: row.target_type || payload.finding?.targetType || '-',
    targetName: row.target_name || payload.finding?.target || '-',
    fieldName: row.field_name || payload.finding?.field || (cells[0]?.fieldName || cells[0]?.field_name || '-'),
    reason: row.reason_code || payload.finding?.reason || '-',
    requestedBy: row.requested_by || '-',
    requestedAt: row.created_at || row.updated_at || '',
    beforeValue: row.before_value || (cells[0]?.beforeValue ?? cells[0]?.before_value ?? ''),
    requestedValue: row.requested_value || (cells[0]?.afterValue ?? cells[0]?.after_value ?? ''),
    displayRequestedValue,
    cellCount: cells.length || 1,
    requestPayload: payload,
    uploadSource: payload.source || '',
    uploadFileName: payload.fileName || '',
    uploaderName: payload.uploaderName || row.requested_by_name || row.requested_by || '-',
    uploadAssetScope: payload.assetScope || row.target_name || '-',
    uploadAt: payload.uploadAt || row.created_at || row.updated_at || '',
    acceptedRows: payload.acceptedRows || cells.length || 0,
    blockedRows: payload.blockedRows || 0,
    raw: row,
  };
}

function inferQualityTargetTable(finding) {
  const source = String(finding?.sourceTable || finding?.raw?.target_table || finding?.raw?.table_name || finding?.sheetName || '');
  if (/history|히스토리|rent/i.test(source)) return 'public.ll_rent_history';
  if (/company|기업/i.test(source)) return 'public.ll_companies';
  if (/asset|자산/i.test(source)) return 'public.ll_assets';
  if (/weekly/i.test(source)) return 'public.ll_weekly_reports';
  return source.startsWith('public.ll_') ? source : 'public.ll_leasing_contracts';
}

function buildDataQualityEditGridRows(finding) {
  if (!finding) return [];
  const raw = finding.raw || {};
  const beforeValue = firstDefined(
    raw.before_value,
    raw.current_value,
    raw.actual_value,
    raw.display_value,
    raw.raw_value,
    raw.value,
    '',
  );
  const sourceRowId = firstDefined(raw.source_row_id, raw.row_id, raw.target_row_id, raw.sourceRowId, '');
  const sourceCellId = firstDefined(raw.source_cell_id, raw.target_cell_id, raw.sourceCellId, raw.cell_ref, '');
  return [{
    id: `${finding.id || 'local'}-${finding.field || 'field'}-0`,
    action: '수정',
    sheetName: finding.sheetName || raw.sheet_name || '-',
    targetTable: inferQualityTargetTable(finding),
    targetRowId: sourceRowId,
    primaryKeyField: 'id',
    sourceCellId,
    fieldName: finding.field || raw.field_name || raw.column_name || '-',
    beforeValue: String(beforeValue ?? ''),
    afterValue: '',
    reason: finding.reason || raw.reason_code || '',
    assetId: String(firstDefined(raw.asset_id, raw.target_asset_id, resolveAssetIdByName(finding.target), '')),
    assetName: String(firstDefined(raw.asset_name, raw.target_asset_name, finding.target, '')),
  }];
}

const QUALITY_EXCEL_COLUMNS = [
  '행위',
  '원본시트',
  '원본행',
  '원본열',
  '계약/행 식별',
  '자산명',
  '자산코드',
  '펀드명',
  '임차인명',
  '사업자등록번호',
  '층/구역',
  '데이터영역',
  '원본항목명',
  '한글필드명',
  '현재값',
  '표시값',
  '수정값',
  '변경사유',
  '권한상태',
  'target_table',
  'target_row_id',
  'primary_key_field',
  'field_name',
  'source_row_id',
  'source_cell_id',
  'before_value',
  'asset_id',
  'tenant_id',
  'lease_id',
  'data_quality_rule',
];

const QUALITY_VISIBLE_COLUMNS = new Set(['행위', '원본시트', '원본행', '원본열', '계약/행 식별', '자산명', '자산코드', '펀드명', '임차인명', '사업자등록번호', '층/구역', '데이터영역', '원본항목명', '한글필드명', '현재값', '표시값', '수정값', '변경사유', '권한상태']);

const QUALITY_EXPORT_FIELDS = [
  { fieldName: 'fundCode', label: '펀드코드', sourceHeader: '펀드코드', sourceColumnLetter: 'B', domain: 'DB_일반', table: 'public.ll_leasing_contracts', valueType: 'text' },
  { fieldName: 'fundName', label: '펀드명', sourceHeader: '펀드명', sourceColumnLetter: 'C', domain: 'DB_일반', table: 'public.ll_leasing_contracts', valueType: 'text' },
  { fieldName: 'assetName', label: '자산명', sourceHeader: '자산명', sourceColumnLetter: 'D', domain: 'DB_일반', table: 'public.ll_assets', valueType: 'text' },
  { fieldName: 'assetCode', label: '자산코드', sourceHeader: '자산코드', sourceColumnLetter: 'E', domain: 'DB_일반', table: 'public.ll_assets', valueType: 'text' },
  { fieldName: 'sector', label: '섹터', sourceHeader: '섹터', sourceColumnLetter: 'F', domain: 'DB_일반', table: 'public.ll_assets', valueType: 'text' },
  { fieldName: 'tenantMasterName', label: '임차인명', sourceHeader: '임차인명', sourceColumnLetter: 'G', domain: 'DB_일반', table: 'public.ll_tenants', valueType: 'text' },
  { fieldName: 'businessRegistrationNo', label: '임차인 사업자번호', sourceHeader: '임차인 사업자번호', sourceColumnLetter: 'H', domain: 'DB_일반', table: 'public.ll_tenants', valueType: 'text' },
  { fieldName: 'coldStorageType', label: '저온창고 여부', sourceHeader: '저온창고 여부', sourceColumnLetter: 'I', domain: 'DB_일반', table: 'public.ll_leasing_contracts', valueType: 'text' },
  { fieldName: 'preLeaseYn', label: '선임차 여부', sourceHeader: '선임차 여부', sourceColumnLetter: 'J', domain: 'DB_일반', table: 'public.ll_leasing_contracts', valueType: 'text' },
  { fieldName: 'thirdPartyLogisticsYn', label: '3PL 여부', sourceHeader: '3PL 여부', sourceColumnLetter: 'K', domain: 'DB_일반', table: 'public.ll_leasing_contracts', valueType: 'text' },
  { fieldName: 'goodsType', label: '취급 상품 유형', sourceHeader: '취급 상품 유형', sourceColumnLetter: 'L', domain: 'DB_일반', table: 'public.ll_leasing_contracts', valueType: 'text' },
  { fieldName: 'floorLabel', label: '임차 층', sourceHeader: '임차 층', sourceColumnLetter: 'M', domain: 'DB_일반', table: 'public.ll_leasing_contracts', valueType: 'text' },
  { fieldName: 'detailAreaLabel', label: '임차 세부 구역', sourceHeader: '임차 세부 구역', sourceColumnLetter: 'N', domain: 'DB_일반', table: 'public.ll_leasing_contracts', valueType: 'text' },
  { fieldName: 'singleTenantYn', label: '단일 임차인 여부', sourceHeader: '단일 임차인 여부', sourceColumnLetter: 'O', domain: 'DB_일반', table: 'public.ll_leasing_contracts', valueType: 'text' },
  { fieldName: 'grossFloorAreaSqm', label: '전체 연면적', sourceHeader: '전체 연면적', sourceColumnLetter: 'P', domain: 'DB_일반', table: 'public.ll_assets', valueType: 'area' },
  { fieldName: 'leasedAreaSqm', label: '임대면적', sourceHeader: '임대면적', sourceColumnLetter: 'Q', domain: 'DB_일반', table: 'public.ll_leasing_contracts', valueType: 'area' },
  { fieldName: 'exclusiveAreaSqm', label: '전용면적', sourceHeader: '전용면적', sourceColumnLetter: 'R', domain: 'DB_일반', table: 'public.ll_leasing_contracts', valueType: 'area' },
  { fieldName: 'exclusiveRate', label: '전용률', sourceHeader: '전용률', sourceColumnLetter: 'S', domain: 'DB_일반', table: 'public.ll_leasing_contracts', valueType: 'percent' },
  { fieldName: 'warehouseAreaSqm', label: '세부면적(창고)', sourceHeader: '세부면적(창고)', sourceColumnLetter: 'AA', domain: 'DB_일반', table: 'public.ll_leasing_contracts', valueType: 'area' },
  { fieldName: 'dockAreaSqm', label: '세부면적(하역장)', sourceHeader: '세부면적(하역장)', sourceColumnLetter: 'AB', domain: 'DB_일반', table: 'public.ll_leasing_contracts', valueType: 'area' },
  { fieldName: 'officeAreaSqm', label: '세부면적(사무실)', sourceHeader: '세부면적(사무실)', sourceColumnLetter: 'AC', domain: 'DB_일반', table: 'public.ll_leasing_contracts', valueType: 'area' },
  { fieldName: 'otherExclusiveAreaSqm', label: '세부면적(기타 전용면적)', sourceHeader: '세부면적(기타 전용면적)', sourceColumnLetter: 'AD', domain: 'DB_일반', table: 'public.ll_leasing_contracts', valueType: 'area' },
  { fieldName: 'corridorAreaSqm', label: '세부면적(통로)', sourceHeader: '세부면적(통로)', sourceColumnLetter: 'AE', domain: 'DB_일반', table: 'public.ll_leasing_contracts', valueType: 'area' },
  { fieldName: 'rampAreaSqm', label: '세부면적(램프)', sourceHeader: '세부면적(램프)', sourceColumnLetter: 'AF', domain: 'DB_일반', table: 'public.ll_leasing_contracts', valueType: 'area' },
  { fieldName: 'mechanicalAreaSqm', label: '세부면적(기계전기실)', sourceHeader: '세부면적(기계전기실)', sourceColumnLetter: 'AG', domain: 'DB_일반', table: 'public.ll_leasing_contracts', valueType: 'area' },
  { fieldName: 'parkingAreaSqm', label: '세부면적(주차장)', sourceHeader: '세부면적(주차장)', sourceColumnLetter: 'AH', domain: 'DB_일반', table: 'public.ll_leasing_contracts', valueType: 'area' },
  { fieldName: 'coreAreaSqm', label: '세부면적(층별 코어)', sourceHeader: '세부면적(층별 코어)', sourceColumnLetter: 'AI', domain: 'DB_일반', table: 'public.ll_leasing_contracts', valueType: 'area' },
  { fieldName: 'otherCommonAreaSqm', label: '세부면적(기타 공용면적)', sourceHeader: '세부면적(기타 공용면적)', sourceColumnLetter: 'AJ', domain: 'DB_일반', table: 'public.ll_leasing_contracts', valueType: 'area' },
  { fieldName: 'officeUseYn', label: '사무실 사용 여부', sourceHeader: '사무실 사용 여부', sourceColumnLetter: 'AK', domain: 'DB_일반', table: 'public.ll_leasing_contracts', valueType: 'text' },
  { fieldName: 'subleaseYn', label: '전차 여부', sourceHeader: '전차 여부', sourceColumnLetter: 'AL', domain: 'DB_일반', table: 'public.ll_leasing_contracts', valueType: 'text' },
  { fieldName: 'firstContractDate', label: '최초 계약일', sourceHeader: '최초 계약일', sourceColumnLetter: 'AR', domain: 'DB_일반', table: 'public.ll_leasing_contracts', valueType: 'date' },
  { fieldName: 'firstStartDate', label: '최초 계약개시일', sourceHeader: '최초 계약개시일', sourceColumnLetter: 'AS', domain: 'DB_일반', table: 'public.ll_leasing_contracts', valueType: 'date' },
  { fieldName: 'firstEndDate', label: '최초 계약만기일', sourceHeader: '최초 계약만기일', sourceColumnLetter: 'AT', domain: 'DB_일반', table: 'public.ll_leasing_contracts', valueType: 'date' },
  { fieldName: 'firstOperationStartDate', label: '최초 운영개시일', sourceHeader: '최초 운영개시일', sourceColumnLetter: 'AU', domain: 'DB_일반', table: 'public.ll_leasing_contracts', valueType: 'date' },
  { fieldName: 'latestContractDate', label: '최근 계약일', sourceHeader: '최근 계약일', sourceColumnLetter: 'AV', domain: 'DB_일반', table: 'public.ll_leasing_contracts', valueType: 'date' },
  { fieldName: 'currentStartDate', label: '현재 계약개시일', sourceHeader: '현재 계약개시일', sourceColumnLetter: 'AW', domain: 'DB_일반', table: 'public.ll_leasing_contracts', valueType: 'date' },
  { fieldName: 'currentEndDate', label: '현재 계약만기일', sourceHeader: '현재 계약만기일', sourceColumnLetter: 'AX', domain: 'DB_일반', table: 'public.ll_leasing_contracts', valueType: 'date' },
  { fieldName: 'currentContractPeriod', label: '현재 계약기간', sourceHeader: '현재 계약기간', sourceColumnLetter: 'AY', domain: 'DB_일반', table: 'public.ll_leasing_contracts', valueType: 'text' },
  { fieldName: 'extensionCount', label: '연장횟수', sourceHeader: '연장횟수', sourceColumnLetter: 'AZ', domain: 'DB_일반', table: 'public.ll_leasing_contracts', valueType: 'number' },
  { fieldName: 'deposit', label: '임대보증금', sourceHeader: '임대보증금', sourceColumnLetter: 'BA', domain: 'DB_일반', table: 'public.ll_leasing_contracts', valueType: 'currency' },
  { fieldName: 'rf', label: 'RF', sourceHeader: 'RF', sourceColumnLetter: 'BB', domain: 'DB_일반', table: 'public.ll_leasing_contracts', valueType: 'text' },
  { fieldName: 'fo', label: 'FO', sourceHeader: 'FO', sourceColumnLetter: 'BC', domain: 'DB_일반', table: 'public.ll_leasing_contracts', valueType: 'text' },
  { fieldName: 'ti', label: 'TI', sourceHeader: 'TI', sourceColumnLetter: 'BD', domain: 'DB_일반', table: 'public.ll_leasing_contracts', valueType: 'currency' },
  { fieldName: 'rentEscalationRate', label: '임대료 인상률', sourceHeader: '임대료 인상률', sourceColumnLetter: 'BE', domain: 'DB_일반', table: 'public.ll_leasing_contracts', valueType: 'percent' },
  { fieldName: 'mfEscalationRate', label: '관리비 인상률', sourceHeader: '관리비 인상률', sourceColumnLetter: 'BF', domain: 'DB_일반', table: 'public.ll_leasing_contracts', valueType: 'text' },
  { fieldName: 'escalationCycleMonths', label: '인상주기', sourceHeader: '인상주기', sourceColumnLetter: 'BG', domain: 'DB_일반', table: 'public.ll_leasing_contracts', valueType: 'number' },
  { fieldName: 'nextEscalationDate', label: '차기 인상일', sourceHeader: '차기 인상일', sourceColumnLetter: 'BH', domain: 'DB_일반', table: 'public.ll_leasing_contracts', valueType: 'date' },
  { fieldName: 'tenantCostBurden', label: '임차인 부담 비용', sourceHeader: '임차인 부담 비용', sourceColumnLetter: 'BI', domain: 'DB_일반', table: 'public.ll_leasing_contracts', valueType: 'text' },
  { fieldName: 'earlyTerminationRightYn', label: '중도해지권', sourceHeader: '중도해지권', sourceColumnLetter: 'BJ', domain: 'DB_일반', table: 'public.ll_leasing_contracts', valueType: 'text' },
  { fieldName: 'renewalOptionYn', label: '갱신 옵션', sourceHeader: '갱신 옵션', sourceColumnLetter: 'BK', domain: 'DB_일반', table: 'public.ll_leasing_contracts', valueType: 'text' },
  { fieldName: 'propertyInsuranceLimit', label: '재산종합보험 한도', sourceHeader: '재산종합보험 한도', sourceColumnLetter: 'BL', domain: 'DB_일반', table: 'public.ll_leasing_contracts', valueType: 'currency' },
  { fieldName: 'liabilityInsuranceLimit', label: '영업배상책임보험 한도', sourceHeader: '영업배상책임보험 한도', sourceColumnLetter: 'BM', domain: 'DB_일반', table: 'public.ll_leasing_contracts', valueType: 'currency' },
  { fieldName: 'businessInterruptionInsuranceLimit', label: '기업휴지보험 한도', sourceHeader: '기업휴지보험 한도', sourceColumnLetter: 'BN', domain: 'DB_일반', table: 'public.ll_leasing_contracts', valueType: 'currency' },
  { fieldName: 'inventoryInsuranceLimit', label: '재고자산보험 한도', sourceHeader: '재고자산보험 한도', sourceColumnLetter: 'BO', domain: 'DB_일반', table: 'public.ll_leasing_contracts', valueType: 'currency' },
  { fieldName: 'waiverRecourseYn', label: '구상권 포기 여부', sourceHeader: '구상권 포기 여부', sourceColumnLetter: 'BP', domain: 'DB_일반', table: 'public.ll_leasing_contracts', valueType: 'text' },
  { fieldName: 'waiverSubrogationYn', label: '대위권 포기 여부', sourceHeader: '대위권 포기 여부', sourceColumnLetter: 'BQ', domain: 'DB_일반', table: 'public.ll_leasing_contracts', valueType: 'text' },
  { fieldName: 'floorLoad', label: '바닥 하중', sourceHeader: '바닥 하중', sourceColumnLetter: 'BR', domain: 'DB_일반', table: 'public.ll_leasing_contracts', valueType: 'text' },
  { fieldName: 'flatnessStandard', label: '평활도 기준', sourceHeader: '평활도 기준', sourceColumnLetter: 'BS', domain: 'DB_일반', table: 'public.ll_leasing_contracts', valueType: 'text' },
  { fieldName: 'abrasionClass', label: '마모도 등급', sourceHeader: '마모도 등급', sourceColumnLetter: 'BT', domain: 'DB_일반', table: 'public.ll_leasing_contracts', valueType: 'text' },
  { fieldName: 'dockDoorCount', label: '(동시) 도크 접안 수', sourceHeader: '(동시) 도크 접안 수', sourceColumnLetter: 'BU', domain: 'DB_일반', table: 'public.ll_leasing_contracts', valueType: 'number' },
  { fieldName: 'clearHeight', label: '층고', sourceHeader: '층고', sourceColumnLetter: 'BV', domain: 'DB_일반', table: 'public.ll_leasing_contracts', valueType: 'number' },
  { fieldName: 'powerCapacity', label: '요구 전력량', sourceHeader: '요구 전력량', sourceColumnLetter: 'BW', domain: 'DB_일반', table: 'public.ll_leasing_contracts', valueType: 'number' },
  { fieldName: 'rampType', label: '램프 타입', sourceHeader: '램프 타입', sourceColumnLetter: 'BX', domain: 'DB_일반', table: 'public.ll_leasing_contracts', valueType: 'text' },
  { fieldName: 'rampWidth', label: '램프 너비', sourceHeader: '램프 너비', sourceColumnLetter: 'BY', domain: 'DB_일반', table: 'public.ll_leasing_contracts', valueType: 'number' },
  { fieldName: 'vehicleAisleWidth', label: '차량 통로 너비', sourceHeader: '차량 통로 너비', sourceColumnLetter: 'BZ', domain: 'DB_일반', table: 'public.ll_leasing_contracts', valueType: 'number' },
  { fieldName: 'lighting', label: '조명', sourceHeader: '조명', sourceColumnLetter: 'CA', domain: 'DB_일반', table: 'public.ll_leasing_contracts', valueType: 'text' },
  { fieldName: 'exteriorMaterial', label: '외벽자재', sourceHeader: '외벽자재', sourceColumnLetter: 'CB', domain: 'DB_일반', table: 'public.ll_leasing_contracts', valueType: 'text' },
  { fieldName: 'contractStatus', label: '계약 상태', sourceHeader: '계약 상태', sourceColumnLetter: 'CC', domain: 'DB_일반', table: 'public.ll_leasing_contracts', valueType: 'text' },
  { fieldName: 'rentArrearsYn', label: '임대료 연체·미납여부', sourceHeader: '임대료 연체·미납여부', sourceColumnLetter: 'CD', domain: 'DB_일반', table: 'public.ll_leasing_contracts', valueType: 'text' },
  { fieldName: 'insuranceSpecialTerms', label: '보험 관련 특수 계약 조건', sourceHeader: '보험 관련 특수 계약 조건', sourceColumnLetter: 'CE', domain: 'DB_일반', table: 'public.ll_leasing_contracts', valueType: 'text' },
  { fieldName: 'otherSpecialTerms', label: '기타 각종 특수 계약 조건', sourceHeader: '기타 각종 특수 계약 조건', sourceColumnLetter: 'CF', domain: 'DB_일반', table: 'public.ll_leasing_contracts', valueType: 'text' },
  { fieldName: 'fundCode', label: '히스토리 펀드코드', sourceHeader: '펀드코드', sourceColumnLetter: 'B', domain: 'DB_히스토리 누적', table: 'public.ll_rent_history', valueType: 'text' },
  { fieldName: 'fundName', label: '히스토리 펀드명', sourceHeader: '펀드명', sourceColumnLetter: 'C', domain: 'DB_히스토리 누적', table: 'public.ll_rent_history', valueType: 'text' },
  { fieldName: 'assetName', label: '히스토리 자산명', sourceHeader: '자산명', sourceColumnLetter: 'D', domain: 'DB_히스토리 누적', table: 'public.ll_rent_history', valueType: 'text' },
  { fieldName: 'assetCode', label: '히스토리 자산코드', sourceHeader: '자산코드', sourceColumnLetter: 'E', domain: 'DB_히스토리 누적', table: 'public.ll_rent_history', valueType: 'text' },
  { fieldName: 'tenantMasterName', label: '히스토리 임차인명', sourceHeader: '임차인명', sourceColumnLetter: 'G', domain: 'DB_히스토리 누적', table: 'public.ll_rent_history', valueType: 'text' },
  { fieldName: 'businessRegistrationNo', label: '히스토리 임차인 사업자번호', sourceHeader: '임차인 사업자번호', sourceColumnLetter: 'H', domain: 'DB_히스토리 누적', table: 'public.ll_rent_history', valueType: 'text' },
  { fieldName: 'coldStorageType', label: '히스토리 저온창고 여부', sourceHeader: '저온창고 여부', sourceColumnLetter: 'I', domain: 'DB_히스토리 누적', table: 'public.ll_rent_history', valueType: 'text' },
  { fieldName: 'floorLabel', label: '히스토리 임차 층', sourceHeader: '임차 층', sourceColumnLetter: 'J', domain: 'DB_히스토리 누적', table: 'public.ll_rent_history', valueType: 'text' },
  { fieldName: 'detailAreaLabel', label: '히스토리 임차 세부 구역', sourceHeader: '임차 세부 구역', sourceColumnLetter: 'K', domain: 'DB_히스토리 누적', table: 'public.ll_rent_history', valueType: 'text' },
  { fieldName: 'leasedAreaSqm', label: '히스토리 임대면적', sourceHeader: '임대면적', sourceColumnLetter: 'L', domain: 'DB_히스토리 누적', table: 'public.ll_rent_history', valueType: 'area' },
  { fieldName: 'exclusiveAreaSqm', label: '히스토리 전용면적', sourceHeader: '전용면적', sourceColumnLetter: 'M', domain: 'DB_히스토리 누적', table: 'public.ll_rent_history', valueType: 'area' },
  { fieldName: 'basisDate', label: '기준일자', sourceHeader: '기준일자', sourceColumnLetter: 'N', domain: 'DB_히스토리 누적', table: 'public.ll_rent_history', valueType: 'date' },
  { fieldName: 'rentChangeReason', label: '임대료 변동 원인', sourceHeader: '임대료 변동 원인', sourceColumnLetter: 'O', domain: 'DB_히스토리 누적', table: 'public.ll_rent_history', valueType: 'text' },
  { fieldName: 'monthlyRentTotal', label: '월임대료 총액', sourceHeader: '월임대료 총액', sourceColumnLetter: 'P', domain: 'DB_히스토리 누적', table: 'public.ll_rent_history', valueType: 'currency' },
  { fieldName: 'monthlyMfTotal', label: '월관리비 총액', sourceHeader: '월관리비 총액', sourceColumnLetter: 'Q', domain: 'DB_히스토리 누적', table: 'public.ll_rent_history', valueType: 'currency' },
  { fieldName: 'currentRentPerPy', label: '평당 월임대료', sourceHeader: '평당 월임대료', sourceColumnLetter: 'R', domain: 'DB_히스토리 누적', table: 'public.ll_rent_history', valueType: 'won' },
  { fieldName: 'currentMfPerPy', label: '평당 월관리비', sourceHeader: '평당 월관리비', sourceColumnLetter: 'S', domain: 'DB_히스토리 누적', table: 'public.ll_rent_history', valueType: 'won' },
];
const QUALITY_ALLOWED_ACTIONS = new Set(['수정']);
const QUALITY_REQUIRED_UPLOAD_COLUMNS = ['행위', '현재값', '수정값', 'target_table', 'target_row_id', 'primary_key_field', 'field_name', 'source_row_id', 'source_cell_id', 'before_value', 'asset_id'];

function excelCellText(value) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function qualityRowId(row, index) {
  return String(firstDefined(row.id, row.leaseId, row.source_row_id, row.sourceRowId, row.rowId, `${row.assetId || row.assetName || 'asset'}-${index}`));
}

function qualityTargetRowId(row, field, fallbackRowId) {
  if (field.table === 'public.ll_assets') return String(firstDefined(row.assetId, row.asset_id, row.assetCode, row.assetName, fallbackRowId));
  if (field.table === 'public.ll_tenants') return String(firstDefined(row.tenantId, row.tenant_id, row.tenantRowId, fallbackRowId));
  if (field.table === 'public.ll_rent_history') return String(firstDefined(row.rentHistoryId, row.rent_history_id, row.historyId, row.history_row_id, row.leaseId, fallbackRowId));
  if (field.table === 'public.ll_leasing_contracts') return String(firstDefined(row.leaseId, row.contractId, row.leaseRowId, fallbackRowId));
  return String(fallbackRowId);
}

function qualityDisplayValue(field, value) {
  if (field.valueType === 'area') return formatArea(value);
  if (field.valueType === 'currency') return formatCurrency(value);
  if (field.valueType === 'won') return formatWon(value);
  if (field.valueType === 'date') return formatDate(value);
  if (field.valueType === 'percent') return formatPercent(value);
  if (field.valueType === 'number') return value === undefined || value === null || value === '' ? '-' : formatNumber(value);
  return excelCellText(value);
}

function buildQualityExcelRows(assetId, permission, findings) {
  const sourceRows = filterAssetsByPermission(buildLogisticsGeneralRows(), permission)
    .filter((row) => assetId === 'all' || row.assetId === assetId || resolveAssetIdByName(row.assetName) === assetId);
  const dataRows = sourceRows.flatMap((row, index) => {
    const rowId = qualityRowId(row, index);
    return QUALITY_EXPORT_FIELDS.map((field) => {
      const value = row[field.sourceValueField || field.fieldName];
      const targetRowId = qualityTargetRowId(row, field, rowId);
      const sourceRowId = excelCellText(firstDefined(row.sourceRowId, row.source_row_id, targetRowId));
      const sourceCellId = excelCellText(firstDefined(row.sourceCellId, row.source_cell_id, `${sourceRowId}:${field.fieldName}`));
      const rowLabel = [row.assetName, row.tenantMasterName, row.spaceLabel || row.floorLabel || row.detailAreaLabel].filter(Boolean).join(' / ');
      return {
        행위: '수정',
        원본시트: field.domain,
        원본행: sourceRowId,
        원본열: field.sourceColumnLetter || '',
        '계약/행 식별': rowLabel || rowId,
        자산명: row.assetName || '',
        자산코드: row.assetCode || row.assetId || '',
        펀드명: row.fundName || '',
        임차인명: row.tenantMasterName || '',
        사업자등록번호: row.businessRegistrationNo || '',
        '층/구역': row.spaceLabel || row.floorLabel || '',
        데이터영역: field.domain,
        원본항목명: field.sourceHeader || field.label,
        한글필드명: field.label,
        현재값: excelCellText(value),
        표시값: qualityDisplayValue(field, value),
        수정값: '',
        변경사유: '',
        권한상태: assetIdMatchesPermission(row.assetId, row.assetName, permission) && permission.permissions?.managedAsset?.update ? '수정 가능' : '수정 권한 없음',
        target_table: field.table,
        target_row_id: targetRowId,
        primary_key_field: 'id',
        field_name: field.fieldName,
        source_row_id: sourceRowId,
        source_cell_id: sourceCellId,
        before_value: excelCellText(value),
        asset_id: row.assetId || resolveAssetIdByName(row.assetName),
        tenant_id: row.tenantId || '',
        lease_id: row.leaseId || rowId,
        data_quality_rule: '',
      };
    });
  });
  const findingRows = findings.flatMap((finding) => buildDataQualityEditGridRows(finding).map((row) => ({
    행위: '수정',
    원본시트: row.sheetName,
    원본행: row.targetRowId,
    원본열: '',
    '계약/행 식별': finding.target || row.targetRowId,
    자산명: finding.targetType === 'asset' ? finding.target : '',
    자산코드: resolveAssetIdByName(finding.target),
    펀드명: '',
    임차인명: finding.targetType === 'company' ? finding.target : '',
    사업자등록번호: '',
    '층/구역': '',
    데이터영역: row.sheetName,
    원본항목명: finding.field,
    한글필드명: finding.field,
    현재값: row.beforeValue,
    표시값: row.beforeValue,
    수정값: '',
    변경사유: finding.action || finding.reason || '',
    권한상태: permission.permissions?.managedAsset?.update ? '수정 가능' : '수정 권한 없음',
    target_table: row.targetTable,
    target_row_id: row.targetRowId,
    primary_key_field: 'id',
    field_name: row.fieldName,
    source_row_id: row.targetRowId,
    source_cell_id: row.sourceCellId || `${row.targetRowId}:${row.fieldName}`,
    before_value: row.beforeValue,
    asset_id: resolveAssetIdByName(finding.target),
    tenant_id: '',
    lease_id: '',
    data_quality_rule: finding.reason,
  }))).filter((row) => assetId === 'all' || !row.asset_id || row.asset_id === assetId);
  return [...dataRows, ...findingRows];
}

function writeQualityWorkbook(rows, fileName) {
  const worksheet = XLSX.utils.json_to_sheet(rows, { header: QUALITY_EXCEL_COLUMNS });
  const widthByColumn = {
    행위: 8,
    원본시트: 16,
    원본행: 18,
    원본열: 8,
    '계약/행 식별': 38,
    자산명: 24,
    자산코드: 14,
    펀드명: 20,
    임차인명: 24,
    사업자등록번호: 16,
    '층/구역': 18,
    데이터영역: 18,
    원본항목명: 24,
    한글필드명: 24,
    현재값: 20,
    표시값: 20,
    수정값: 24,
    변경사유: 30,
    권한상태: 14,
  };
  worksheet['!cols'] = QUALITY_EXCEL_COLUMNS.map((column) => ({
    wch: QUALITY_VISIBLE_COLUMNS.has(column) ? (widthByColumn[column] || Math.max(12, column.length + 8)) : 18,
    hidden: !QUALITY_VISIBLE_COLUMNS.has(column),
  }));
  worksheet['!freeze'] = { xSplit: 0, ySplit: 1 };
  if (worksheet['!ref']) worksheet['!autofilter'] = { ref: worksheet['!ref'] };
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '원본 데이터 수정');
  workbook.Workbook = { Sheets: [{ name: '원본 데이터 수정' }] };
  XLSX.writeFile(workbook, fileName, { compression: true });
}

async function readQualityWorkbook(file) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
  if (workbook.SheetNames.length !== 1) throw new Error('수정 Excel 파일은 반드시 한 시트만 포함해야 합니다.');
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  if (!worksheet) throw new Error('첫 번째 시트를 읽을 수 없습니다.');
  const headerRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', raw: false });
  const headers = (headerRows[0] || []).map((item) => String(item || '').trim());
  const missingColumns = QUALITY_REQUIRED_UPLOAD_COLUMNS.filter((column) => !headers.includes(column));
  if (missingColumns.length) throw new Error(`필수 관계키 컬럼이 누락됐습니다: ${missingColumns.join(', ')}`);
  const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false });
  if (rows.length > 5000) throw new Error('한 번에 업로드할 수 있는 수정 행은 5,000행 이하입니다.');
  return rows;
}

function normalizeQualityWorkbookRows(rows, permission) {
  return rows.map((row, index) => {
    const assetId = String(row.asset_id || resolveAssetIdByName(row.자산명));
    const requestedAction = String(row.행위 || '수정').trim() || '수정';
    const action = requestedAction;
    const targetTable = String(row.target_table || '');
    const targetRowId = String(row.target_row_id || '');
    const fieldName = String(row.field_name || '');
    const sourceRowId = String(row.source_row_id || '');
    const sourceCellId = String(row.source_cell_id || '');
    const beforeValue = excelCellText(row.before_value || row.현재값);
    const afterValue = excelCellText(row.수정값);
    const validationError = !QUALITY_ALLOWED_ACTIONS.has(action)
      ? '현재 Excel 왕복 수정 파일은 수정 행위만 지원합니다. 추가/삭제는 Data Quality 전용 승인 화면에서 별도 처리합니다.'
      : !targetTable.startsWith('public.ll_')
        ? 'target_table은 public.ll_* 형식이어야 합니다.'
      : !targetRowId
        ? 'target_row_id가 비어 있습니다.'
        : !fieldName
          ? 'field_name이 비어 있습니다.'
          : !sourceRowId
            ? 'source_row_id가 비어 있습니다.'
            : !sourceCellId
              ? 'source_cell_id가 비어 있습니다.'
              : action === '수정' && afterValue === beforeValue
                ? '수정값이 현재값과 같습니다.'
                : '';
    return {
      id: `excel-${index}`,
      sheetName: row.데이터영역 || 'Data Quality Excel',
      targetTable,
      targetRowId,
      primaryKeyField: String(row.primary_key_field || 'id'),
      sourceCellId,
      sourceRowId,
      fieldName,
      beforeValue,
      afterValue,
      reason: String(row.변경사유 || 'Excel 왕복 수정'),
      action,
      assetId,
      assetName: String(row.자산명 || ''),
      tenantId: String(row.tenant_id || ''),
      leaseId: String(row.lease_id || ''),
      canEdit: assetIdMatchesPermission(assetId, row.자산명, permission) && Boolean(permission.permissions?.managedAsset?.update),
      validationError,
      original: row,
    };
  }).filter((row) => {
    if (!row.afterValue && row.action === '수정') return false;
    return true;
  });
}

function parseJsonObject(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function OriginalDataEditPanel({ permission }) {
  const [qualityAssetId, setQualityAssetId] = useState('all');
  const [excelStatus, setExcelStatus] = useState(null);
  const excelUploadRef = useRef(null);
  const qualityFindings = useMemo(() => buildDataQualityFindings(), []);
  const qualityAssetOptions = useMemo(() => (
    filterAssetsByPermission(assetOptionsData, permission)
      .filter((asset) => permission.permissions?.managedAsset?.update || permission.permissions?.managedAsset?.create || permission.permissions?.managedAsset?.delete || assetIdMatchesPermission(asset.assetId, asset.assetName, permission))
      .sort((a, b) => String(a.assetName || '').localeCompare(String(b.assetName || ''), 'ko-KR'))
  ), [permission]);
  const canUseQualityExcel = Boolean(permission.permissions?.managedAsset?.update || permission.permissions?.managedAsset?.create || permission.permissions?.managedAsset?.delete);

  const downloadQualityWorkbook = () => {
    const rows = buildQualityExcelRows(qualityAssetId, permission, qualityFindings);
    if (!rows.length) {
      setExcelStatus({ type: 'error', message: '선택한 자산 범위에서 다운로드할 수정 대상 데이터가 없습니다.' });
      return;
    }
    const assetName = qualityAssetId === 'all'
      ? '담당자산전체'
      : (qualityAssetOptions.find((asset) => asset.assetId === qualityAssetId)?.assetName || qualityAssetId);
    writeQualityWorkbook(rows, `물류_원본데이터수정_${safeFileNameText(assetName)}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    setExcelStatus({ type: 'success', message: `${assetName} 기준 ${formatNumber(rows.length)}개 항목 수정 파일을 다운로드했습니다.` });
  };

  const importQualityWorkbook = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!/\.xlsx?$/iu.test(file.name)) {
      setExcelStatus({ type: 'error', message: 'xlsx 또는 xls 파일만 업로드할 수 있습니다.' });
      if (excelUploadRef.current) excelUploadRef.current.value = '';
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setExcelStatus({ type: 'error', message: 'Excel 수정 파일은 10MB 이하만 업로드할 수 있습니다.' });
      if (excelUploadRef.current) excelUploadRef.current.value = '';
      return;
    }
    setExcelStatus({ type: 'pending', message: '수정 Excel 파일을 읽고 권한 범위를 확인하는 중입니다.' });
    try {
      const rows = await readQualityWorkbook(file);
      const normalizedRows = normalizeQualityWorkbookRows(rows, permission);
      const invalidRows = normalizedRows.filter((row) => row.validationError && row.validationError !== '수정값이 현재값과 같습니다.');
      if (invalidRows.length) {
        setExcelStatus({ type: 'error', message: `필수 관계키 또는 수정 필드가 깨진 행 ${formatNumber(invalidRows.length)}건이 있어 업로드를 차단했습니다. 첫 오류: ${invalidRows[0].validationError}` });
        return;
      }
      const outOfSelectedScopeRows = normalizedRows.filter((row) => qualityAssetId !== 'all' && row.assetId && row.assetId !== qualityAssetId);
      if (outOfSelectedScopeRows.length) {
        setExcelStatus({ type: 'error', message: `선택한 자산 범위 밖의 수정 행 ${formatNumber(outOfSelectedScopeRows.length)}건이 포함되어 업로드를 차단했습니다.` });
        return;
      }
      const blockedRows = normalizedRows.filter((row) => !row.canEdit);
      const editableRows = normalizedRows.filter((row) => row.canEdit);
      if (!editableRows.length) {
        setExcelStatus({ type: 'error', message: blockedRows.length ? '수정 권한이 없는 자산만 포함되어 업로드가 차단됐습니다.' : '수정값이 입력된 행을 찾지 못했습니다.' });
        return;
      }
      const cellEdits = editableRows.map((row) => ({
        target_table: row.targetTable,
        target_row_id: row.targetRowId,
        target_cell_id: row.sourceCellId,
        source_row_id: row.sourceRowId,
        field_name: row.fieldName,
        primary_key_field: row.primaryKeyField || 'id',
        action: row.action || '수정',
        before_value: row.beforeValue,
        after_value: row.afterValue,
        asset_id: row.assetId || null,
        asset_name: row.assetName || null,
        tenant_id: row.tenantId || null,
        lease_id: row.leaseId || null,
        reason: row.reason,
      }));
      const assetName = qualityAssetId === 'all'
        ? '내 수정 가능 자산 전체'
        : (qualityAssetOptions.find((asset) => asset.assetId === qualityAssetId)?.assetName || qualityAssetId);
      const uploadAt = new Date().toISOString();
      const { data, error } = await supabase.functions.invoke('ll-dashboard-api', {
        body: {
          action: 'edits/submit',
          payload: {
            source_table: 'public.ll_data_quality_findings',
            finding_id: null,
            target_type: 'excel_batch',
            target_name: `${assetName} · 원본 데이터 수정`,
            field_name: 'excel_batch',
            reason_code: 'excel_roundtrip_upload',
            requested_value: JSON.stringify(cellEdits),
            request_payload: {
              source: 'quality_excel_roundtrip',
              fileName: file.name,
              uploaderName: permission.name,
              uploaderEmail: permission.email,
              organization: permission.organization,
              uploadAt,
              assetScope: assetName,
              totalRows: rows.length,
              acceptedRows: editableRows.length,
              blockedRows: blockedRows.length,
              selectedQualityAssetId: qualityAssetId,
              permission_source: logisticsPermissionData.sourceFile,
              cell_edits: cellEdits,
            },
          },
        },
      });
      if (error) throw error;
      setExcelStatus({ type: blockedRows.length ? 'warning' : 'success', message: data?.message || `${permission.name}님의 ${assetName} 수정 요청 ${formatNumber(editableRows.length)}행을 Data Quality 승인 대기열에 접수했습니다.${blockedRows.length ? ` 권한 밖 ${formatNumber(blockedRows.length)}행은 제외했습니다.` : ''}` });
    } catch (error) {
      setExcelStatus({ type: 'error', message: `Excel 수정 요청 접수 실패: ${error.message || 'unknown error'}` });
    } finally {
      if (excelUploadRef.current) excelUploadRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(260px,420px)_1fr_auto] xl:items-end">
        <label className="block">
          <span className="mb-2 block text-[12px] font-semibold text-[#86868B]">수정 대상 자산</span>
          <select
            value={qualityAssetId}
            onChange={(event) => setQualityAssetId(event.target.value)}
            className="h-10 w-full rounded-[8px] border border-[#3A3A3C] bg-[#1F1F1E] px-3 text-[13px] text-white"
          >
            <option value="all">내 수정 가능 자산 전체</option>
            {qualityAssetOptions.map((asset) => <option key={asset.assetId} value={asset.assetId}>{asset.assetName}</option>)}
          </select>
        </label>
        <div className="min-h-10" />
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" disabled={!canUseQualityExcel} onClick={downloadQualityWorkbook} className="h-10 rounded-[8px] border border-[#3A3A3C] bg-[#30302F] px-4 text-[13px] font-bold text-white hover:bg-[#3A3A3A] disabled:cursor-not-allowed disabled:opacity-40">
            Excel 다운로드
          </button>
          <input ref={excelUploadRef} type="file" accept=".xlsx,.xls" onChange={importQualityWorkbook} className="hidden" />
          <button type="button" disabled={!canUseQualityExcel} onClick={() => excelUploadRef.current?.click()} className="h-10 rounded-[8px] border border-[#3A3A3C] bg-[#30302F] px-4 text-[13px] font-bold text-white hover:bg-[#3A3A3A] disabled:cursor-not-allowed disabled:opacity-40">
            수정 Excel 업로드
          </button>
        </div>
      </div>
      {excelStatus ? (
        <div className={`rounded-[10px] border px-4 py-3 text-[12px] leading-5 ${excelStatus.type === 'success' ? 'border-[#2E6B45] bg-[#173522] text-[#B5E48C]' : excelStatus.type === 'warning' || excelStatus.type === 'pending' ? 'border-[#7A6425] bg-[#2B2613] text-[#FFD166]' : 'border-[#6F3434] bg-[#331F1F] text-[#FF9F9F]'}`}>
          {excelStatus.message}
        </div>
      ) : null}
    </div>
  );
}

async function fetchRemoteQualityFindings(signal) {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  const { data, error } = await supabase.functions.invoke('ll-dashboard-api', {
    body: { action: 'quality/findings', payload: { limit: 300 } },
  });
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  if (error) throw error;
  const rows = Array.isArray(data?.data) ? data.data : [];
  return {
    status: 'loaded',
    rows: rows.map(normalizeRemoteQualityFinding),
    message: `Edge readback public.ll_data_quality_findings ${rows.length}건`,
  };
}

function DataQualityDashboard() {
  const { memberInfo } = useAuth();
  const permission = useMemo(() => resolveLogisticsPermission(memberInfo), [memberInfo]);
  const canEdit = Boolean(permission.permissions?.managedAsset?.update || permission.permissions?.managedAsset?.create);
  const canApproveEdits = canViewDataQuality(memberInfo, permission) && hasLogisticsRole(permission, 'Manager');
  const [severity, setSeverity] = useState('all');
  const [sheetFilter, setSheetFilter] = useState('all');
  const [fieldFilter, setFieldFilter] = useState('all');
  const [modal, setModal] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [editGridRows, setEditGridRows] = useState([]);
  const [editSubmitStatus, setEditSubmitStatus] = useState(null);
  const [remoteQuality, setRemoteQuality] = useState({ status: 'loading', rows: [], message: 'Supabase readback 확인 중' });
  const [editQueue, setEditQueue] = useState({ status: 'loading', rows: [], message: '승인 대기 목록 확인 중' });
  const [editQueueStatus, setEditQueueStatus] = useState(null);
  const localFindings = useMemo(() => buildDataQualityFindings(), []);
  useEffect(() => {
    const controller = new AbortController();
    fetchRemoteQualityFindings(controller.signal)
      .then((result) => setRemoteQuality(result))
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setRemoteQuality({ status: 'blocked', rows: [], message: error.message || 'Supabase readback 실패' });
        }
      });
    return () => controller.abort();
  }, []);
  const refreshEditQueue = async () => {
    setEditQueue((current) => ({ ...current, status: 'loading', message: '승인 대기 목록 확인 중' }));
    try {
      const { data, error } = await supabase.functions.invoke('ll-dashboard-api', {
        body: { action: 'edits/list', payload: { status: 'submitted', limit: 100 } },
      });
      if (error) throw error;
      const rows = Array.isArray(data?.data) ? data.data.map(normalizeRemoteEditRequest) : [];
      setEditQueue({ status: 'loaded', rows, message: `승인 대기 ${rows.length}건` });
    } catch (error) {
      setEditQueue({ status: 'blocked', rows: [], message: `Edge Function 승인 목록 확인 필요: ${error.message || 'unknown error'}` });
    }
  };
  useEffect(() => {
    refreshEditQueue();
  }, []);
  useEffect(() => {
    setEditGridRows(buildDataQualityEditGridRows(editTarget));
  }, [editTarget]);
  const findings = remoteQuality.rows.length ? remoteQuality.rows : localFindings;
  const sourceLabel = remoteQuality.rows.length
    ? `Supabase findings ${formatNumber(remoteQuality.rows.length)}건`
    : `${remoteQuality.message} · 파생 검사 ${formatNumber(localFindings.length)}건`;
  const visibleFindings = findings.filter((item) => (
    (severity === 'all' || item.severity === severity)
    && (sheetFilter === 'all' || item.sheetName === sheetFilter)
    && (fieldFilter === 'all' || item.field === fieldFilter)
  ));
  const severityCounts = ['critical', 'warning', 'info'].map((key) => [key, findings.filter((item) => item.severity === key).length]);
  const sheetGroups = [...new Set(findings.map((item) => item.sheetName))].filter(Boolean);
  const fieldGroups = [...new Set(findings.map((item) => item.field))].filter(Boolean);
  const tableRows = visibleFindings.map((item) => [
    item.severity,
    item.sheetName,
    item.targetType,
    item.target,
    item.field,
    item.reason,
    item.action,
    <button key={`${item.target}-${item.field}`} type="button" onClick={() => { setEditTarget(item); setEditSubmitStatus(null); }} className="h-8 rounded-[8px] border border-[#3A3A3C] bg-[#1F1F1E] px-3 text-[12px] font-semibold text-white hover:bg-[#30302F]">{canEdit ? '수정 요청' : '권한 확인'}</button>,
  ]);
  const excelUploadRequests = editQueue.rows
    .filter((request) => request.uploadSource === 'quality_excel_roundtrip' || request.reason === 'excel_roundtrip_upload')
    .slice(0, 5);
  const changedEditRows = editGridRows.filter((row) => {
    const afterValue = String(row.afterValue || '').trim();
    return afterValue !== '' && afterValue !== String(row.beforeValue || '');
  });
  const updateEditGridRow = (rowId, key, value) => {
    setEditGridRows((prev) => prev.map((row) => (row.id === rowId ? { ...row, [key]: value } : row)));
  };
  const addEditGridRow = () => {
    const base = editGridRows[0] || buildDataQualityEditGridRows(editTarget)[0] || {};
    setEditGridRows((prev) => [
      ...prev,
      {
        ...base,
        id: `${base.id || 'edit'}-${prev.length}`,
        fieldName: '',
        beforeValue: '',
        afterValue: '',
        reason: editTarget?.reason || '',
      },
    ]);
  };
  const submitEditRequest = async () => {
    if (!canEdit || !editTarget) return;
    if (!changedEditRows.length) {
      setEditSubmitStatus({ type: 'error', message: '변경할 셀의 after 값을 입력해 주세요.' });
      return;
    }
    setEditSubmitStatus({ type: 'pending', message: '수정 요청 저장 중' });
    try {
      const { data, error } = await supabase.functions.invoke('ll-dashboard-api', {
        body: {
          action: 'edits/submit',
          payload: {
            source_table: editTarget.sourceTable || 'public.ll_data_quality_findings',
            finding_id: editTarget.id || null,
            target_type: editTarget.targetType,
            target_name: editTarget.target,
            field_name: editTarget.field,
            reason_code: editTarget.reason,
            requested_value: JSON.stringify(changedEditRows.map((row) => ({
              target_table: row.targetTable,
              target_row_id: row.targetRowId,
              target_cell_id: row.sourceCellId,
              field_name: row.fieldName,
              primary_key_field: row.primaryKeyField || 'id',
              action: row.action || '수정',
              before_value: row.beforeValue,
              after_value: row.afterValue,
              asset_id: row.assetId || null,
              asset_name: row.assetName || null,
              reason: row.reason,
            }))),
            request_payload: {
              finding: editTarget.raw || editTarget,
              cell_edits: changedEditRows,
              permission_source: logisticsPermissionData.sourceFile,
            },
          },
        },
      });
      if (error) throw error;
      setEditSubmitStatus({ type: 'success', message: data?.message || '수정 요청이 서버로 접수됐습니다.' });
      refreshEditQueue();
    } catch (error) {
      setEditSubmitStatus({ type: 'error', message: `Edge Function 연결 필요: ${error.message || 'unknown error'}` });
    }
  };
  const readbackEditRequest = async (request) => {
    if (!canApproveEdits) return;
    setEditQueueStatus({ type: 'pending', message: '승인 전 현재 DB 값 readback 확인 중입니다.' });
    try {
      const { data, error } = await supabase.functions.invoke('ll-dashboard-api', {
        body: { action: 'edits/readback', payload: { id: request.id } },
      });
      if (error) throw error;
      const readbacks = data?.data?.readbacks || [];
      const staleCount = readbacks.filter((row) => row.stale).length;
      setModal({
        title: `승인 전 readback · ${request.targetName}`,
        headers: ['table', 'row', 'field', '요청 당시 값', '현재 DB 값', '요청 값', '상태'],
        rows: readbacks.map((row) => [
          row.target_table,
          row.target_row_id,
          row.field_name,
          cleanDisplay(row.before_value),
          cleanDisplay(row.current_value),
          cleanDisplay(row.requested_value),
          row.stale ? 'stale 차단 대상' : '승인 가능',
        ]),
      });
      setEditQueueStatus({ type: staleCount ? 'warning' : 'success', message: staleCount ? `현재 DB 값이 바뀐 셀 ${staleCount}건이 있어 승인 시 차단됩니다.` : '현재 DB 값이 요청 당시 before 값과 일치합니다.' });
    } catch (error) {
      setEditQueueStatus({ type: 'error', message: `readback 실패: ${error.message || 'unknown error'}` });
    }
  };
  const approveEditRequest = async (request) => {
    if (!canApproveEdits) return;
    setEditQueueStatus({ type: 'pending', message: '승인, write, readback, audit 기록 중입니다.' });
    try {
      const { data, error } = await supabase.functions.invoke('ll-dashboard-api', {
        body: { action: 'edits/approve', payload: { id: request.id } },
      });
      if (error) throw error;
      setEditQueueStatus({ type: 'success', message: data?.message || '승인 및 DB 반영이 완료되었습니다.' });
      refreshEditQueue();
    } catch (error) {
      setEditQueueStatus({ type: 'error', message: `승인 실패: ${error.message || 'unknown error'}` });
      refreshEditQueue();
    }
  };
  const rejectEditRequest = async (request) => {
    if (!canApproveEdits) return;
    setEditQueueStatus({ type: 'pending', message: '반려 처리 중입니다.' });
    try {
      const { data, error } = await supabase.functions.invoke('ll-dashboard-api', {
        body: { action: 'edits/reject', payload: { id: request.id, rejection_note: 'Data Quality 화면 반려' } },
      });
      if (error) throw error;
      setEditQueueStatus({ type: 'success', message: data?.message || '수정 요청이 반려되었습니다.' });
      refreshEditQueue();
    } catch (error) {
      setEditQueueStatus({ type: 'error', message: `반려 실패: ${error.message || 'unknown error'}` });
    }
  };
  return (
    <div className="space-y-6">
      <LogisticsModal modal={modal} onClose={() => setModal(null)} />
      {excelUploadRequests.length ? (
        <section className="rounded-[20px] border border-[#7A6425] bg-[#2B2613] p-5">
          <SectionHeader
            eyebrow="UPLOAD ALERT"
            title="원본 데이터 수정 업로드 알림"
            right={<StatusPill className="border-[#7A6425] bg-[#1F1A10] text-[#FFD166]">관리자 확인 후 최종 반영</StatusPill>}
          />
          <DataTable
            headers={['업로드한 사람', '자산 범위', '업로드 시각', '수정 행', '제외 행', '파일', '상태']}
            rows={excelUploadRequests.map((request) => [
              request.uploaderName || request.requestedBy,
              request.uploadAssetScope,
              formatDate(request.uploadAt),
              `${formatNumber(request.acceptedRows)}행`,
              `${formatNumber(request.blockedRows)}행`,
              trimMainText(request.uploadFileName || '-', 32),
              request.status,
            ])}
            compact
          />
        </section>
      ) : null}
      <section className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
        <SectionHeader
          eyebrow="DATA QUALITY"
          title="데이터 무결성 검사 및 수정 요청"
          right={(
            <div className="flex flex-wrap justify-end gap-2">
              <StatusPill className={remoteQuality.status === 'loaded' ? 'bg-[#173522] text-[#B5E48C] border-[#2E6B45]' : 'bg-[#2B2613] text-[#FFD166] border-[#7A6425]'}>{sourceLabel}</StatusPill>
              <StatusPill className={canEdit ? 'bg-[#173522] text-[#B5E48C] border-[#2E6B45]' : 'bg-[#2B2613] text-[#FFD166] border-[#7A6425]'}>{canEdit ? '수정 권한 있음' : '수정 권한 제한'}</StatusPill>
            </div>
          )}
        />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <button type="button" onClick={() => setSeverity('all')} className={`rounded-[14px] border px-4 py-4 text-left ${severity === 'all' ? 'border-white bg-white text-[#1F1F1E]' : 'border-[#333333] bg-[#1F1F1E] text-white hover:bg-[#2A2A29]'}`}>
            <div className="text-[12px] font-semibold opacity-70">총 점검 항목</div>
            <div className="mt-2 text-[24px] font-semibold">{formatNumber(findings.length)}건</div>
          </button>
          {severityCounts.map(([key, count]) => (
            <button key={key} type="button" onClick={() => setSeverity(key)} className={`rounded-[14px] border px-4 py-4 text-left ${severity === key ? 'border-white bg-white text-[#1F1F1E]' : 'border-[#333333] bg-[#1F1F1E] text-white hover:bg-[#2A2A29]'}`}>
              <div className="text-[12px] font-semibold opacity-70">{key}</div>
              <div className="mt-2 text-[24px] font-semibold">{formatNumber(count)}건</div>
            </button>
          ))}
          <button type="button" onClick={() => setModal({ title: '수정 권한 기준', headers: ['항목', '내용'], rows: [['권한 원본', logisticsPermissionData.sourceFile], ['현재 사용자', permission.name], ['조직', permission.organization], ['담당 자산 수정', permissionText(permission.permissions?.managedAsset?.update)], ['서버 검증', 'Edge Function/RLS에서 JWT와 public.ll_* 권한 재확인 필요']] })} className="rounded-[14px] border border-[#333333] bg-[#1F1F1E] px-4 py-4 text-left text-white hover:bg-[#2A2A29]">
            <div className="text-[12px] font-semibold text-[#86868B]">권한 기준</div>
            <div className="mt-2 text-[18px] font-semibold">담당자별 권한표</div>
          </button>
        </div>
      </section>
      <section className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
        <SectionHeader
          eyebrow="APPROVAL QUEUE"
          title="수정 요청 승인 대기"
          right={(
            <div className="flex flex-wrap justify-end gap-2">
              <StatusPill className={editQueue.status === 'loaded' ? 'bg-[#173522] text-[#B5E48C] border-[#2E6B45]' : 'bg-[#2B2613] text-[#FFD166] border-[#7A6425]'}>{editQueue.message}</StatusPill>
              <button type="button" onClick={refreshEditQueue} className="h-8 rounded-[8px] border border-[#3A3A3C] bg-[#1F1F1E] px-3 text-[12px] font-semibold text-white hover:bg-[#30302F]">새로고침</button>
            </div>
          )}
        />
        {editQueueStatus ? (
          <div className={`mb-3 rounded-[10px] border px-4 py-3 text-[12px] leading-5 ${editQueueStatus.type === 'success' ? 'border-[#2E6B45] bg-[#173522] text-[#B5E48C]' : editQueueStatus.type === 'error' ? 'border-[#6F3434] bg-[#331F1F] text-[#FF9F9F]' : 'border-[#7A6425] bg-[#2B2613] text-[#FFD166]'}`}>
            {editQueueStatus.message}
          </div>
        ) : null}
        <DataTable
          headers={['상태', '대상', '필드', '요청값', '요청자', '요청일', 'readback', '승인', '반려']}
          rows={editQueue.rows.map((request) => [
            request.status,
            `${request.targetType} · ${request.targetName}`,
            request.fieldName,
            trimMainText(cleanDisplay(request.displayRequestedValue || request.requestedValue), 52),
            request.requestedBy,
            formatDate(request.requestedAt),
            <button key={`${request.id}-readback`} type="button" disabled={!canApproveEdits} onClick={() => readbackEditRequest(request)} className="h-8 rounded-[8px] border border-[#3A3A3C] bg-[#1F1F1E] px-3 text-[12px] font-semibold text-white hover:bg-[#30302F] disabled:cursor-not-allowed disabled:opacity-40">확인</button>,
            <button key={`${request.id}-approve`} type="button" disabled={!canApproveEdits} onClick={() => approveEditRequest(request)} className="h-8 rounded-[8px] border border-[#3b82f6]/30 bg-[#3b82f6]/20 px-3 text-[12px] font-semibold text-[#60a5fa] hover:bg-[#3b82f6]/30 disabled:cursor-not-allowed disabled:opacity-40">승인</button>,
            <button key={`${request.id}-reject`} type="button" disabled={!canApproveEdits} onClick={() => rejectEditRequest(request)} className="h-8 rounded-[8px] border border-[#6F3434] bg-[#331F1F] px-3 text-[12px] font-semibold text-[#FF9F9F] hover:bg-[#432424] disabled:cursor-not-allowed disabled:opacity-40">반려</button>,
          ])}
          compact
        />
        {!editQueue.rows.length ? (
          <div className="mt-3 rounded-[12px] border border-[#333333] bg-[#1F1F1E] px-4 py-5 text-[13px] text-[#86868B]">현재 승인 대기 중인 수정 요청이 없습니다.</div>
        ) : null}
      </section>
      <section className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
        <SectionHeader eyebrow="GROUPS" title="시트·필드별 필터" />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-[12px] font-semibold text-[#86868B]">시트</span>
            <select value={sheetFilter} onChange={(event) => setSheetFilter(event.target.value)} className="h-10 w-full rounded-[8px] border border-[#3A3A3C] bg-[#1F1F1E] px-3 text-[13px] text-white">
              <option value="all">전체</option>
              {sheetGroups.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-[12px] font-semibold text-[#86868B]">필드</span>
            <select value={fieldFilter} onChange={(event) => setFieldFilter(event.target.value)} className="h-10 w-full rounded-[8px] border border-[#3A3A3C] bg-[#1F1F1E] px-3 text-[13px] text-white">
              <option value="all">전체</option>
              {fieldGroups.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
        </div>
      </section>
      <section className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
        <SectionHeader eyebrow="FINDINGS" title="무결성 점검 결과" />
        <DataTable headers={['등급', '시트', '대상', '이름', '필드', '원인', '조치', '수정']} rows={tableRows} compact />
      </section>
      {editTarget && (
        <MainOverlay title={`데이터 수정 요청 · ${editTarget.target}`} eyebrow="EDIT REQUEST" onClose={() => setEditTarget(null)}>
          <div className="space-y-4">
            <DataTable headers={['항목', '내용']} rows={[
              ['대상', editTarget.target],
              ['필드', editTarget.field],
              ['원인 분류', editTarget.reason],
              ['권한 상태', canEdit ? '수정 요청 가능' : '수정 권한 없음'],
              ['처리 방식', '프론트 직접 수정 금지. /edits/submit Edge Function에서 JWT와 public.ll_* 권한 재검증 후 반영'],
            ]} compact />
            <div className="rounded-[14px] border border-[#333333] bg-[#1F1F1E]">
              <div className="flex items-center justify-between gap-3 border-b border-[#333333] px-4 py-3">
                <div>
                  <div className="text-[12px] font-semibold text-[#86868B]">Excel-like edit grid</div>
                  <div className="mt-1 text-[14px] font-semibold text-white">셀 단위 before/after 수정 요청</div>
                </div>
                <button type="button" disabled={!canEdit} onClick={addEditGridRow} className="h-9 rounded-[8px] border border-[#3A3A3C] bg-[#252524] px-3 text-[12px] font-semibold text-white hover:bg-[#30302F] disabled:cursor-not-allowed disabled:opacity-40">행 추가</button>
              </div>
              <div className="custom-scrollbar overflow-auto">
                <table className="min-w-[1480px] w-full table-fixed border-collapse text-left text-[12px]">
                  <colgroup>
                    <col className="w-[90px]" />
                    <col className="w-[130px]" />
                    <col className="w-[180px]" />
                    <col className="w-[150px]" />
                    <col className="w-[120px]" />
                    <col className="w-[150px]" />
                    <col className="w-[150px]" />
                    <col className="w-[180px]" />
                    <col className="w-[180px]" />
                    <col className="w-[220px]" />
                  </colgroup>
                  <thead className="bg-[#252524] text-[#A1A1AA]">
                    <tr>
                      {['행위', '시트', '대상 테이블', 'row id', 'pk field', 'source cell', '필드', 'before', 'after', '수정 사유'].map((header) => (
                        <th key={header} className="border-b border-[#333333] px-3 py-2 font-semibold">{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {editGridRows.map((row) => (
                      <tr key={row.id} className="border-b border-[#333333] last:border-b-0">
                        {['action', 'sheetName', 'targetTable', 'targetRowId', 'primaryKeyField', 'sourceCellId', 'fieldName', 'beforeValue', 'afterValue', 'reason'].map((key) => (
                          <td key={`${row.id}-${key}`} className="align-top px-2 py-2">
                            <input
                              disabled={!canEdit || key === 'beforeValue'}
                              value={row[key] || ''}
                              onChange={(event) => updateEditGridRow(row.id, key, event.target.value)}
                              className={`h-9 w-full rounded-[7px] border border-[#3A3A3C] px-2 text-[12px] outline-none ${key === 'beforeValue' ? 'bg-[#151515] text-[#A1A1AA]' : 'bg-[#101010] text-white focus:border-[#9AD7FF]'} disabled:opacity-70`}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {editSubmitStatus ? (
              <div className={`rounded-[10px] border px-3 py-2 text-[12px] ${editSubmitStatus.type === 'success' ? 'border-[#2E6B45] bg-[#173522] text-[#B5E48C]' : editSubmitStatus.type === 'error' ? 'border-[#6F3434] bg-[#331F1F] text-[#FF9F9F]' : 'border-[#7A6425] bg-[#2B2613] text-[#FFD166]'}`}>
                {editSubmitStatus.message}
              </div>
            ) : null}
            <div className="flex justify-end">
              <button type="button" disabled={!canEdit || !changedEditRows.length || editSubmitStatus?.type === 'pending'} onClick={submitEditRequest} className="h-10 rounded-[8px] bg-white px-4 text-[13px] font-bold text-[#1F1F1E] disabled:cursor-not-allowed disabled:opacity-40">수정 요청 저장</button>
            </div>
          </div>
        </MainOverlay>
      )}
    </div>
  );
}

function AssetDashboard() {
  const { memberInfo } = useAuth();
  const permission = useMemo(() => resolveLogisticsPermission(memberInfo), [memberInfo]);
  const readableAssetOptions = useMemo(() => filterAssetsByPermission(assetOptionsData, permission), [permission]);
  const storedAssetId = typeof window !== 'undefined' ? window.sessionStorage.getItem('logisticsSelectedAssetId') : '';
  const defaultAssetId = storedAssetId && ASSET_PAYLOADS[storedAssetId] && assetIdMatchesPermission(storedAssetId, ASSET_PAYLOADS[storedAssetId]?.overview?.assetName, permission)
    ? storedAssetId
    : readableAssetOptions[0]?.assetId || assetOptionsData[0]?.assetId || Object.keys(ASSET_PAYLOADS)[0];
  const [selectedAssetId, setSelectedAssetId] = useState(defaultAssetId);
  const [modal, setModal] = useState(null);
  const [buildingApiStatus, setBuildingApiStatus] = useState(null);
  const rawPayload = ASSET_PAYLOADS[selectedAssetId] || ASSET_PAYLOADS[defaultAssetId] || Object.values(ASSET_PAYLOADS)[0];
  const asset = useMemo(() => normalizeAssetPayload(rawPayload || {}), [rawPayload]);
  const overview = asset.overview || {};
  const breakdown = asset.areaBreakdown || {};
  const rows = asset.normalizedRows || [];
  const assetWeightedENoc = calculateWeightedENoc(rows, overview.averageENoc);
  const buildingRegisterSource = rows.find((row) => row.asset?.sigunguCd || row.sigunguCd) || overview;
  const buildingRegisterPayload = buildBuildingRegisterPayload(buildingRegisterSource);
  const kpiByKey = Object.fromEntries((asset.kpis || []).map((item) => [item.key, item]));
  const kpis = [
    kpiByKey.gross_floor_area_total || { key: 'gross_floor_area_total', label: '총 연면적', value: overview.grossFloorAreaSqm, valueType: 'area' },
    kpiByKey.occupancy_rate || { key: 'occupancy_rate', label: '임대율', value: 1 - Number(overview.vacancyRate || 0), valueType: 'percent' },
    kpiByKey.leased_area_total || { key: 'leased_area_total', label: '총 임대면적', value: overview.leasedAreaSqm, valueType: 'area' },
    kpiByKey.vacancy_area_total || { key: 'vacancy_area_total', label: '공실면적', value: overview.vacancyAreaSqm, valueType: 'area' },
    kpiByKey.monthly_total_cost || { key: 'monthly_total_cost', label: '월 임관리비 총액', value: overview.monthlyCostTotal, valueType: 'currency' },
    kpiByKey.average_e_noc || { key: 'average_e_noc', label: 'E. NOC', value: assetWeightedENoc, valueType: 'won' },
    kpiByKey.unique_tenant_count || { key: 'unique_tenant_count', label: '현재 임차인 수', value: firstDefined(overview.uniqueTenantCount, rows.length), valueType: 'count' },
  ].map((item) => ({
    ...item,
    valueType: item.key === 'average_e_noc' ? 'won' : item.valueType,
    value: item.key === 'average_e_noc'
      ? assetWeightedENoc
      : item.key === 'gross_floor_area_total'
        ? overview.grossFloorAreaSqm
        : item.key === 'occupancy_rate'
          ? 1 - Number(overview.vacancyRate || 0)
          : item.key === 'leased_area_total'
            ? overview.leasedAreaSqm
            : item.key === 'vacancy_area_total'
              ? overview.vacancyAreaSqm
              : item.key === 'unique_tenant_count'
                ? firstDefined(overview.uniqueTenantCount, rows.length)
                : firstDefined(item.value, item.key === 'monthly_total_cost' ? overview.monthlyCostTotal : item.value),
  }));
  const mapPoint = overview.latitude != null && overview.longitude != null ? [{
    assetId: overview.assetId,
    assetName: overview.assetName,
    address: overview.standardizedAddress,
    latitude: overview.latitude,
    longitude: overview.longitude,
  }] : [];
  const openTableModal = (title, headers, tableRows) => setModal({ title, headers, rows: tableRows });
  const refreshBuildingRegister = async () => {
    if (!isCompleteBuildingRegisterPayload(buildingRegisterPayload)) {
      setBuildingApiStatus({ type: 'blocked', message: '건축물대장 조회에 필요한 시군구코드, 법정동코드, 본번, 부번이 부족합니다.' });
      return;
    }
    setBuildingApiStatus({ type: 'loading', message: '건축물대장 서버 함수를 호출하는 중입니다.' });
    try {
      const { data, error } = await supabase.functions.invoke('ll-dashboard-api', {
        body: { action: 'building-register/summary', payload: buildingRegisterPayload },
      });
      if (error) throw error;
      const summary = data?.data || {};
      setBuildingApiStatus({ type: data?.ok ? 'success' : 'blocked', message: data?.ok ? '건축물대장 server-only 조회 응답을 받았습니다.' : `건축물대장 provider 상태 확인 필요: ${data?.provider_status || '-'}` });
      setModal({
        title: '건축물대장 조회 결과',
        headers: ['항목', '값'],
        rows: [
          ['자산명', overview.assetName || '-'],
          ['대지위치', summary.plat_plc || '-'],
          ['도로명주소', summary.new_plat_plc || '-'],
          ['건물명', summary.bld_nm || '-'],
          ['주용도', summary.main_purps_cd_nm || '-'],
          ['지상/지하층', `${summary.grnd_flr_cnt || '-'} / ${summary.ugrnd_flr_cnt || '-'}`],
          ['연면적', summary.tot_area || '-'],
          ['사용승인일', summary.use_apr_day || '-'],
        ],
      });
    } catch (error) {
      setBuildingApiStatus({ type: 'blocked', message: `건축물대장 Edge Function 연결 또는 secret 설정이 필요합니다. (${error.message || 'unknown error'})` });
    }
  };
  const openTenantDetail = (tenant, title = '임차인 상세') => {
    if (!tenant) return;
    const matchedRows = rows.filter((row) => (
      (tenant.tenantId && row.tenantId === tenant.tenantId)
      || row.tenantMasterName === tenant.tenantMasterName
    ));
    const source = matchedRows[0] || tenant;
    setModal({
      title,
      content: (
        <div className="space-y-4">
          <DataTable
            headers={['항목', '내용']}
            rows={[
              ['임차인명', source.tenantMasterName || '-'],
              ['층/세부구역', source.spaceLabel || source.floorLabel || source.detailAreaLabel || '-'],
              ['임대면적(평)', formatArea(firstDefined(source.leasedAreaSqm, tenant.leasedAreaSqm))],
              ['월 임대료', formatCurrency(firstDefined(source.monthlyRentTotal, tenant.monthlyRentTotal))],
              ['월 관리비', formatCurrency(firstDefined(source.monthlyMfTotal, tenant.monthlyMfTotal))],
              ['월 임관리비', formatCurrency(firstDefined(source.monthlyCombinedTotal, source.monthlyCostTotal, tenant.monthlyCombinedTotal, tenant.monthlyCostTotal))],
              ['E. NOC', formatWon(firstDefined(source.eNoc, source.averageENoc, tenant.eNoc, tenant.averageENoc))],
              ['평당 임대료', formatWon(firstDefined(source.currentRentPerPy, tenant.rentPerPy))],
              ['평당 관리비', formatWon(firstDefined(source.currentMfPerPy, tenant.mfPerPy))],
              ['현재 계약개시일', formatDate(source.currentStartDate)],
              ['현재 계약만기일', formatDate(firstDefined(source.currentEndDate, tenant.latestExpiry, tenant.earliestExpiry))],
            ]}
            compact
          />
          {matchedRows.length > 1 ? (
            <DataTable
              headers={rosterHeaders}
              rows={matchedRows.map((row) => [
                row.tenantMasterName,
                row.spaceLabel,
                formatArea(row.leasedAreaSqm),
                formatCurrency(row.monthlyRentTotal),
                formatCurrency(row.monthlyMfTotal),
                formatCurrency(row.monthlyCombinedTotal),
                formatWon(firstDefined(row.eNoc, row.averageENoc, row.currentENoc, row.currentENocPerPy)),
                formatWon(row.currentRentPerPy),
                formatWon(row.currentMfPerPy),
                formatDate(row.currentStartDate),
                formatDate(row.currentEndDate),
              ])}
              compact
            />
          ) : null}
        </div>
      ),
    });
  };
  const openENocAudit = () => {
    const audit = asset.analytics?.eNocAudit || {};
    const auditRows = audit.rows || [];
    const computableRows = auditRows.filter((row) => row.calculationStatus === 'ok' || row.recomputedENoc != null);
    const missingRows = auditRows.filter((row) => row.calculationStatus && row.calculationStatus !== 'ok');
    const varianceRows = auditRows.filter((row) => Math.abs(Number(row.variance || 0)) > 1);
    setModal({
      title: 'E.NOC 검산 결과',
      content: (
        <div className="space-y-4">
          <DataTable
            headers={['항목', '내용']}
            rows={[
              ['현재 자산', overview.assetName || '-'],
              ['평균 E.NOC', formatWon(firstDefined(assetWeightedENoc, overview.averageENoc, kpis.find((item) => item.key === 'average_e_noc')?.value))],
              ['검산 가능 row', `${formatNumber(computableRows.length)}개`],
              ['입력 누락 row', `${formatNumber(missingRows.length)}개`],
              ['차이 발생 row', `${formatNumber(varianceRows.length)}개`],
              ['수식 기준', asset.meta?.basis?.eNoc || 'rent_per_py + mf_per_py, adjusted by RF/FO/TI and exclusive ratio'],
            ]}
            compact
          />
          <DataTable
            headers={['임차인명', '저장 E.NOC', '재계산 E.NOC', '차이', 'rent/평', 'mf/평']}
            rows={auditRows.slice(0, 30).map((row) => [
              row.tenantMasterName || '-',
              formatWon(row.storedENoc),
              formatWon(row.recomputedENoc),
              formatNumber(row.variance),
              formatWon(row.rentPerPy),
              formatWon(row.mfPerPy),
            ])}
            compact
          />
        </div>
      ),
    });
  };
  const exclusiveAreaSqm = Number(firstDefined(
    breakdown.exclusiveAreaSqm,
    Number(breakdown.warehouseAreaSqm || 0) + Number(breakdown.dockAreaSqm || 0) + Number(breakdown.officeAreaSqm || 0) + Number(breakdown.otherExclusiveAreaSqm || 0),
  ) || 0);
  const commonAreaSqm = Number(firstDefined(
    breakdown.commonAreaSqm,
    Number(breakdown.coreAreaSqm || 0) + Number(breakdown.corridorAreaSqm || 0) + Number(breakdown.mechanicalAreaSqm || 0) + Number(breakdown.otherCommonAreaSqm || 0) + Number(breakdown.rampAreaSqm || 0) + Number(breakdown.parkingAreaSqm || 0),
  ) || 0);
  const recomputedGrossAreaSqm = exclusiveAreaSqm + commonAreaSqm;
  const sourceGrossAreaSqm = Number(firstDefined(breakdown.grossFloorAreaSqm, overview.grossFloorAreaSqm) || 0);
  const leasedAreaForBasisSqm = Number(firstDefined(
    overview.leasedAreaSqm,
    kpiByKey.leased_area_total?.value,
    sumRows(rows, (row) => firstDefined(row.leasedAreaSqm, row.currentLeasedAreaSqm)),
    0,
  ) || 0);
  const vacancyAreaForBasisSqm = Number(firstDefined(
    overview.vacancyAreaSqm,
    breakdown.vacancyAreaSqm,
    kpiByKey.vacancy_area_total?.value,
    0,
  ) || 0);
  const occupancyGrossAreaSqm = leasedAreaForBasisSqm + vacancyAreaForBasisSqm;
  const areaBasisSqm = Math.max(sourceGrossAreaSqm, recomputedGrossAreaSqm, occupancyGrossAreaSqm);
  const areaRatio = (value) => (areaBasisSqm > 0 ? formatPercent(Number(value || 0) / areaBasisSqm) : '-');
  const areaRows = [
    [<span key="gross" className="font-bold text-white">전체 연면적</span>, formatArea(areaBasisSqm), '100.0%'],
    [<span key="exclusive" className="font-bold text-white">전용면적 subtotal</span>, formatArea(exclusiveAreaSqm), areaRatio(exclusiveAreaSqm)],
    [<span key="warehouse" className="pl-4">창고</span>, formatArea(breakdown.warehouseAreaSqm), areaRatio(breakdown.warehouseAreaSqm)],
    [<span key="dock" className="pl-4">하역장</span>, formatArea(breakdown.dockAreaSqm), areaRatio(breakdown.dockAreaSqm)],
    [<span key="office" className="pl-4">사무실</span>, formatArea(breakdown.officeAreaSqm), areaRatio(breakdown.officeAreaSqm)],
    [<span key="other-exclusive" className="pl-4">기타 전용</span>, formatArea(breakdown.otherExclusiveAreaSqm), areaRatio(breakdown.otherExclusiveAreaSqm)],
    [<span key="common" className="font-bold text-white">공용면적 subtotal</span>, formatArea(commonAreaSqm), areaRatio(commonAreaSqm)],
    [<span key="mechanical" className="pl-4">기계전기실</span>, formatArea(breakdown.mechanicalAreaSqm), areaRatio(breakdown.mechanicalAreaSqm)],
    [<span key="core" className="pl-4">층별 코어</span>, formatArea(breakdown.coreAreaSqm), areaRatio(breakdown.coreAreaSqm)],
    [<span key="other-common" className="pl-4">기타 공용</span>, formatArea(breakdown.otherCommonAreaSqm), areaRatio(breakdown.otherCommonAreaSqm)],
    [<span key="corridor" className="pl-4">통로</span>, formatArea(breakdown.corridorAreaSqm), areaRatio(breakdown.corridorAreaSqm)],
    [<span key="ramp" className="pl-4">램프</span>, formatArea(breakdown.rampAreaSqm), areaRatio(breakdown.rampAreaSqm)],
    [<span key="parking" className="pl-4">주차장</span>, formatArea(breakdown.parkingAreaSqm), areaRatio(breakdown.parkingAreaSqm)],
  ];
  const rosterHeaders = ['임차인명', '층/세부구역', '임대면적(평)', '월 임대료', '월 관리비', '월 임관리비', 'E. NOC', '평당 임대료', '평당 관리비', '현재 계약개시일', '현재 계약만기일'];
  const rosterRows = rows.map((row) => [
    row.tenantMasterName,
    row.spaceLabel,
    formatArea(row.leasedAreaSqm),
    formatCurrency(row.monthlyRentTotal),
    formatCurrency(row.monthlyMfTotal),
    formatCurrency(row.monthlyCombinedTotal),
    formatWon(firstDefined(row.eNoc, row.averageENoc, row.currentENoc, row.currentENocPerPy)),
    formatWon(row.currentRentPerPy),
    formatWon(row.currentMfPerPy),
    formatDate(row.currentStartDate),
    formatDate(row.currentEndDate),
  ]);
  const expiryRows = (asset.expiryRows || []).map((row) => [
    row.tenantMasterName || '-',
    row.spaceLabel || row.detailAreaLabel || row.floorLabel || '-',
    formatDate(firstDefined(row.currentEndDate, row.earliestExpiry, row.latestExpiry)),
    formatNumber(row.monthsToExpiry),
    formatCurrency(firstDefined(row.monthlyCostTotal, row.monthlyCombinedTotal)),
  ]);
  const expiryChartRows = (asset.expiryRows || []).map((row) => {
    const zone = row.spaceLabel || row.detailAreaLabel || row.floorLabel || '-';
    const expiryDate = formatDate(firstDefined(row.currentEndDate, row.earliestExpiry, row.latestExpiry));
    return {
      ...row,
      expiryChartLabel: `${row.tenantMasterName || '-'} · ${zone}`,
      tooltipLines: [
        ['구역(층)', zone],
        ['계약만기일', expiryDate],
        ['잔여개월', `${formatNumber(row.monthsToExpiry)}개월`],
        ['월 임관리비', formatCurrency(firstDefined(row.monthlyCostTotal, row.monthlyCombinedTotal))],
      ],
    };
  });
  const monthlyCostHeaders = ['임차인명', 'Lease Space 수', '임대면적(평)', '월 임대료', '월 관리비', '월 임관리비'];
  const monthlyCostRows = (asset.monthlyCostByTenant || []).map((row) => [
    row.tenantMasterName,
    formatNumber(row.leaseSpaceCount),
    formatArea(row.leasedAreaSqm),
    formatCurrency(row.monthlyRentTotal),
    formatCurrency(row.monthlyMfTotal),
    formatCurrency(firstDefined(row.monthlyCostTotal, row.monthlyCombinedTotal)),
  ]);

  return (
    <div className="space-y-6">
      <LogisticsModal modal={modal} onClose={() => setModal(null)} />
      <section className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
        <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-5">
          <div>
            <div className="text-[12px] text-[#86868B] font-semibold">자산 개요</div>
            <h3 className="mt-1 flex flex-wrap items-end gap-2 text-[26px] font-semibold text-white">
              <span>{overview.assetName || '자산'}</span>
              {overview.fundName ? <span className="pb-1 text-[13px] font-medium text-[#A1A1AA]">{overview.fundName}</span> : null}
            </h3>
            <p className="text-[13px] text-[#A1A1AA] mt-2">{overview.standardizedAddress || '주소 미입력'} · 사용승인 {formatDate(overview.approvalDate)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select value={selectedAssetId} onChange={(event) => {
              window.sessionStorage.setItem('logisticsSelectedAssetId', event.target.value);
              setSelectedAssetId(event.target.value);
              setBuildingApiStatus(null);
            }} className="h-10 min-w-[280px] rounded-[8px] border border-[#3A3A3C] bg-[#1F1F1E] px-3 text-[13px] text-white">
              {readableAssetOptions.map((item) => <option key={item.assetId} value={item.assetId}>{item.assetName}</option>)}
            </select>
            <button type="button" onClick={() => (mapPoint.length ? setModal({ title: '포트폴리오 위치', content: <div className="space-y-4"><PortfolioMapPlot points={mapPoint} /><DataTable headers={['자산명', '주소', '좌표']} rows={[[overview.assetName, overview.standardizedAddress || '-', `${overview.latitude}, ${overview.longitude}`]]} compact /></div> }) : openTableModal('자산 위치 정보', ['항목', '내용'], [['자산명', overview.assetName || '-'], ['주소', overview.standardizedAddress || '-'], ['좌표', '미입력']]))} className="h-10 px-3 rounded-[8px] bg-white text-[#1F1F1E] text-[13px] font-semibold hover:bg-[#E5E5E5]">자산 위치 보기</button>
            <button type="button" onClick={refreshBuildingRegister} className="h-10 px-3 rounded-[8px] bg-[#30302F] text-white text-[13px] font-semibold hover:bg-[#3A3A3A]">건축물대장 조회</button>
          </div>
        </div>
        {buildingApiStatus ? (
          <div className={`mt-4 rounded-[10px] border px-4 py-3 text-[12px] leading-5 ${buildingApiStatus.type === 'success' ? 'border-[#2E6B45] bg-[#173522] text-[#B5E48C]' : buildingApiStatus.type === 'loading' ? 'border-[#34537A] bg-[#202C3D] text-[#9AD7FF]' : 'border-[#7A6425] bg-[#2B2613] text-[#FFD166]'}`}>
            {buildingApiStatus.message}
          </div>
        ) : null}
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-7 gap-3">
        {kpis.map((item) => (
          <button key={item.key || item.label} type="button" onClick={() => {
            if (item.key === 'average_e_noc') {
              openENocAudit();
              return;
            }
            openTableModal(item.label, ['항목', '내용'], [['값', formatMetric(item.value, item.valueType)], ['자산', overview.assetName || '-'], ['상태', item.status || '-']]);
          }} className="text-left rounded-[14px] border border-[#333333] bg-[#252524] px-4 py-4 hover:bg-[#2A2A29]">
            <div className="text-[12px] text-[#86868B] font-semibold">{item.label}</div>
            <div className="text-[22px] text-white font-semibold mt-2">{item.key === 'monthly_total_cost' && item.value != null ? `${formatDecimalNumber(Number(item.value) / 100000000, 1)}억` : formatMetric(item.value, item.valueType)}</div>
          </button>
        ))}
      </section>

      <section className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
        <SectionHeader eyebrow="TENANTS" title="임차인 현황" right={<button type="button" onClick={() => openTableModal('임차인 현황', rosterHeaders, rosterRows)} className="h-9 px-3 rounded-[8px] bg-[#30302F] text-white text-[13px] font-semibold hover:bg-[#3A3A3A]">원본 표 보기</button>} />
        <DataTable headers={rosterHeaders} rows={rosterRows} onRowClick={(index) => openTenantDetail(rows[index], '임차인 상세')} compact />
      </section>

      <section className="grid grid-cols-1 gap-5">
        <div className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
          <SectionHeader eyebrow="RENT" title="임차인별 월 임관리비" right={<button type="button" onClick={() => openTableModal('임차인별 월 임관리비', monthlyCostHeaders, monthlyCostRows)} className="h-9 px-3 rounded-[8px] bg-[#30302F] text-white text-[13px] font-semibold hover:bg-[#3A3A3A]">상세 보기</button>} />
          <RichBarChart rows={asset.monthlyCostByTenant} labelKey="tenantMasterName" valueKey="monthlyCostTotal" valueType="currency" valueLabel="임차인별 월 임관리비" onClick={() => openTableModal('임차인별 월 임관리비', monthlyCostHeaders, monthlyCostRows)} />
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
          <SectionHeader eyebrow="STACKING" title="층별 배치" />
          <StackingPlan floors={overview.floors || asset.stackingPlan} onTenantClick={(tenant) => openTenantDetail(tenant, '임차인 상세')} />
        </div>
        <div className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
          <SectionHeader eyebrow="AREA" title="면적 구성" />
          <DataTable headers={['항목', '면적(평)', '비율']} rows={areaRows} compact />
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
          <SectionHeader eyebrow="EXPIRY" title="만기 스냅샷" right={<button type="button" onClick={() => openTableModal('만기 스냅샷', ['임차인명', '세부 구역', '계약만기일', '잔여 개월', '월 임관리비'], expiryRows)} className="h-9 px-3 rounded-[8px] bg-[#30302F] text-white text-[13px] font-semibold hover:bg-[#3A3A3A]">원본 표 보기</button>} />
          <RichBarChart rows={expiryChartRows} labelKey="expiryChartLabel" valueKey="monthsToExpiry" valueType="number" valueLabel="계약만기까지 잔여 개월" onClick={() => openTableModal('만기 스냅샷', ['임차인명', '세부 구역', '계약만기일', '잔여 개월', '월 임관리비'], expiryRows)} />
        </div>
      </section>
    </div>
  );
}

function DashboardShell({ activeModule }) {
  const { memberInfo } = useAuth();
  const permission = useMemo(() => resolveLogisticsPermission(memberInfo), [memberInfo]);
  const [modal, setModal] = useState(null);
  const visibleModules = useMemo(() => (
    MODULES.filter((item) => !ADMIN_ONLY_MODULE_IDS.has(item.id) || canViewAdvancedLogisticsTools(memberInfo, permission))
  ), [memberInfo, permission]);
  const selected = visibleModules.find((item) => item.id === activeModule) || visibleModules[0];
  const canUseOriginalDataEdit = canViewAdvancedLogisticsTools(memberInfo, permission);

  return (
    <div className="w-full max-w-[1480px] mx-auto px-8 pt-8 pb-14">
      <LogisticsModal modal={modal} onClose={() => setModal(null)} />
      <SectionHeader
        eyebrow="INTERNAL MODULE"
        title="임대차 Dashboard"
        right={canUseOriginalDataEdit ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setModal({ title: '원본 데이터 수정', size: 'wide', content: <OriginalDataEditPanel permission={permission} /> })}
              className={`h-9 rounded-[8px] border px-3 text-[13px] font-semibold ${DARK_BUTTON_CLASS}`}
            >
              원본 데이터 수정
            </button>
          </div>
        ) : null}
      />

      {selected.id === 'home' ? <HomeDashboard /> : selected.id === 'asset' ? <AssetDashboard /> : selected.id === 'company' ? <CompanyDashboard /> : selected.id === 'tools' ? <AnalysisToolsDashboard /> : selected.id === 'playground' ? <DataPlaygroundDashboard /> : selected.id === 'quality' ? <DataQualityDashboard /> : null}
    </div>
  );
}

function LegacyWorkspaceLogistics({ currentPath = '' }) {
  const { memberInfo } = useAuth();
  const [query, setQuery] = useState('');
  const [scopeFilter, setScopeFilter] = useState('전체');
  const permission = useMemo(() => resolveLogisticsPermission(memberInfo), [memberInfo]);

  const isDashboard = currentPath.startsWith(pathFor('dashboard'));
  const legacyRequestedModule = currentPath.split('/').pop() || 'home';
  const activeModule = legacyRequestedModule === 'weekly' ? 'home' : legacyRequestedModule;
  const dataCounts = useMemo(() => {
    const readableAssets = filterAssetsByPermission(assetOptionsData, permission);
    const readableAssetNames = new Set(readableAssets.map((asset) => cleanDisplay(asset.assetName, '')));
    const tenantNames = new Set();
    Object.values(COMPANY_PAYLOADS).forEach((payload) => {
      const leasedAssets = payload?.leasedAssets || payload?.leases || [];
      if (leasedAssets.some((row) => readableAssetNames.has(cleanDisplay(row.assetName, '')))) {
        tenantNames.add(cleanDisplay(payload?.profile?.tenantMasterName || payload?.profile?.tenantName, ''));
      }
    });
    return {
      assets: readableAssets.length,
      tenants: tenantNames.size || companyOptionsData.length,
      leases: Object.values(ASSET_PAYLOADS).reduce((sum, payload) => sum + (payload?.leaseSpaces || payload?.contracts || []).length, 0),
      issues: (weeklyReportData.assetRows || []).filter((row) => readableAssetNames.has(cleanDisplay(row.assetName, '')) && row.mainIssue).length,
    };
  }, [permission]);

  const visibleLogs = useMemo(() => {
    const text = query.trim().toLowerCase();
    return WORKLOGS.filter((item) => {
      const matchesScope = scopeFilter === '전체' || item.scope === scopeFilter;
      if (!matchesScope) return false;
      if (!text) return true;
      return [item.title, item.owner, item.status, item.priority, item.asset, item.note].join(' ').toLowerCase().includes(text);
    });
  }, [query, scopeFilter]);

  if (isDashboard) {
    return <DashboardShell activeModule={MODULES.some((item) => item.id === activeModule) ? activeModule : 'home'} />;
  }

  const weekly = dataCounts
    ? [
      { label: '자산', value: String(dataCounts.assets ?? 17), tone: 'text-[#B5E48C]' },
      { label: '임차인', value: String(dataCounts.tenants ?? 36), tone: 'text-[#9AD7FF]' },
      { label: '계약', value: String(dataCounts.leases ?? 45), tone: 'text-[#FFD166]' },
      { label: '이슈', value: String(dataCounts.issues ?? 42), tone: 'text-[#FF9F9F]' },
    ]
    : WEEKLY_ITEMS;

  return (
    <div className="w-full max-w-[1480px] mx-auto px-8 pt-8 pb-14">
      <header className="mb-8">
        <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-5">
          <div>
            <div className="text-[13px] font-semibold text-[#86868B] tracking-[0.03em]">LOGISTICS SECTOR WORKSPACE</div>
            <h1 className="text-[34px] font-semibold tracking-tight text-white mt-2">물류센터 워크 플랫폼</h1>
            <div className="text-[15px] text-[#A1A1AA] mt-3">
              업무 기록, Weekly 현황, 검색, 개인/팀/섹터 업무를 한 화면에서 관리합니다.
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusPill className="bg-[#173522] text-[#B5E48C] border-[#2E6B45]">조회 모드</StatusPill>
            <StatusPill className="bg-[#222] text-[#C7C7CC] border-[#3A3A3C]">{memberInfo?.staff_name || '로그인 사용자'}</StatusPill>
            <StatusPill className="bg-[#1F1F1E] text-[#FFD166] border-[#4C4329]">관리 메뉴 비노출</StatusPill>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-5 mb-6">
        <div className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
          <SectionHeader eyebrow="WORK LOG" title="업무 기록" />
          <div className="flex flex-col md:flex-row gap-3 mb-4">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-10 flex-1 rounded-[8px] border border-[#3A3A3C] bg-[#1F1F1E] px-3 text-[14px] text-white placeholder:text-[#6E6E73] outline-none focus:border-[#2997ff]"
              placeholder="자산, 임차인, 회사, 업무 검색"
            />
            <div className="flex rounded-[8px] border border-[#3A3A3C] bg-[#1F1F1E] p-1">
              {['전체', '개인', '팀', '섹터'].map((scope) => (
                <button
                  key={scope}
                  type="button"
                  onClick={() => setScopeFilter(scope)}
                  className={`h-8 px-3 rounded-[6px] text-[13px] font-semibold transition-colors ${scopeFilter === scope ? 'bg-white text-[#1F1F1E]' : 'text-[#A1A1AA] hover:text-white'}`}
                >
                  {scope}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-hidden rounded-[14px] border border-[#333333]">
            <table className="w-full text-left border-collapse">
              <thead className="bg-[#1F1F1E] text-[#86868B] text-[12px]">
                <tr>
                  <th className="py-3 pl-4 pr-3 font-semibold">구분</th>
                  <th className="py-3 px-3 font-semibold">업무</th>
                  <th className="py-3 px-3 font-semibold">담당</th>
                  <th className="py-3 px-3 font-semibold">상태</th>
                  <th className="py-3 px-3 font-semibold">우선순위</th>
                  <th className="py-3 px-3 font-semibold">기한</th>
                  <th className="py-3 pr-4 pl-3 font-semibold">연결</th>
                </tr>
              </thead>
              <tbody>
                {visibleLogs.map((item) => <WorklogRow key={item.id} item={item} />)}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
          <SectionHeader
            eyebrow="WEEKLY"
            title="Weekly 업무현황"
            right={<button type="button" onClick={() => navigateTo(pathFor('dashboard/weekly'))} className="h-9 px-3 rounded-[8px] bg-[#30302F] text-white text-[13px] font-semibold hover:bg-[#3A3A3A]">Dashboard</button>}
          />
          <div className="grid grid-cols-2 gap-3 mb-5">
            {weekly.map((item) => (
              <div key={item.label} className="rounded-[14px] border border-[#333333] bg-[#1F1F1E] px-4 py-4">
                <div className="text-[12px] text-[#86868B] font-semibold">{item.label}</div>
                <div className={`text-[28px] font-semibold mt-2 tracking-tight ${item.tone}`}>{item.value}</div>
              </div>
            ))}
          </div>
          <div className="rounded-[14px] border border-[#333333] overflow-hidden">
            {DATA_STATUS.map((item) => (
              <div key={item.label} className="grid grid-cols-[1fr_auto] gap-4 px-4 py-3 border-b border-[#333333] last:border-b-0 bg-[#1F1F1E]">
                <div>
                  <div className="text-[13px] text-white font-semibold">{item.label}</div>
                  <div className="text-[12px] text-[#86868B] mt-1">{item.detail}</div>
                </div>
                <div className="text-[13px] text-[#C7C7CC] font-semibold">{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {['개인 업무 리스트', '팀 업무 리스트', '섹터 업무 리스트'].map((title, index) => {
          const scopes = ['개인', '팀', '섹터'];
          const rows = WORKLOGS.filter((item) => item.scope === scopes[index]);
          return (
            <div key={title} className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
              <SectionHeader eyebrow={scopes[index].toUpperCase()} title={title} />
              <div className="space-y-3">
                {rows.map((item) => (
                  <div key={item.id} className="rounded-[12px] border border-[#333333] bg-[#1F1F1E] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-[14px] text-white font-semibold">{item.title}</div>
                      <StatusPill className={STATUS_STYLES[item.status] || 'bg-[#262626] text-[#E5E5E5] border-[#3A3A3C]'}>
                        {item.status}
                      </StatusPill>
                    </div>
                    <div className="text-[12px] text-[#86868B] mt-2">{item.asset} · {item.due}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
