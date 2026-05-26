import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase, supabaseAnonKey, supabaseUrl } from '../../../utils/supabaseClient';
import { useAuth } from '../../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';
import weeklyReportData from './logisticsWeeklyReportData.json';
import logisticsPermissionData from './logisticsPermissionData.json';
import WorkspaceActivityLog from './WorkspaceActivityLog';
import homeData from './logisticsHomeData.json';
import rawAssetOptionsData from './logisticsAssetOptionsData.json';
import companyOptionsData from './logisticsCompanyOptionsData.json';
import sectorData from './logisticsSectorData.json';
import { LOGISTICS_INTERNAL_BASE, normalizeLogisticsPath, pathForLogisticsUrl } from './logisticsRoutes';

const MotionDiv = motion.div;

const assetPayloadModules = import.meta.glob('./logisticsAssetData/*.json', { eager: true });
const ASSET_PAYLOADS = Object.fromEntries(Object.values(assetPayloadModules)
  .map((module) => module.default)
  .filter(Boolean)
  .map((payload) => [payload.overview?.assetId || payload.meta?.selection?.assetId, payload]));
const assetOptionsData = rawAssetOptionsData.map((option) => {
  const overview = ASSET_PAYLOADS[option.assetId]?.overview;
  if (!overview) return option;
  return {
    ...option,
    assetName: option.assetName || overview.assetName,
    uniqueTenantCount: firstDefined(overview.uniqueTenantCount, overview.tenantCount, option.uniqueTenantCount),
    averageENoc: firstDefined(overview.averageENoc, option.averageENoc),
    vacancyRate: firstDefined(overview.vacancyRate, option.vacancyRate),
    monthlyCostTotal: firstDefined(overview.monthlyCostTotal, option.monthlyCostTotal),
  };
});
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
  { id: 'playground', label: 'Pivot Table', source: 'Pivot Table' },
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
const DASHBOARD_READ_MODE = import.meta.env.VITE_LOGISTICS_DASHBOARD_READ_MODE || 'primary-safe';
const DASHBOARD_READ_CACHE = new Map();
const ASSET_PROJECT_DETAIL_CACHE = new Map();
const ASSET_FUND_OVERVIEW_CACHE = new Map();
const ASSET_BUILDING_REGISTER_CACHE = new Map();
const DATA_QUALITY_ALLOWED_NAMES = new Set(['이시정', '전기영', '이관용']);
const DASHBOARD_BASIS_DATE = currentKstMonthEndDate();
const DASHBOARD_BASIS_LABEL = dashboardBasisLabel(DASHBOARD_BASIS_DATE);
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

function currentKstMonthEndDate() {
  const now = new Date();
  const kst = new Date(now.getTime() + (9 * 60 * 60 * 1000));
  const year = kst.getUTCFullYear();
  const month = kst.getUTCMonth() + 1;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
}

function dashboardBasisLabel(basisDate) {
  const [year, month] = String(basisDate || '').split('-');
  return year && month ? `${year}년 ${Number(month)}월 기준` : '현재월 기준';
}

function pathFor(suffix = '') {
  const base = LOGISTICS_INTERNAL_BASE;
  return suffix ? `${base}/${suffix}` : base;
}

function numericDiff(expected, actual) {
  const left = Number(expected);
  const right = Number(actual);
  if (!Number.isFinite(left) || !Number.isFinite(right)) return null;
  return right - left;
}

function edgeErrorStatus(error) {
  const rawStatus = firstDefined(
    error?.status,
    error?.context?.status,
    error?.response?.status,
    error?.details?.status,
    error?.data?.status,
  );
  const status = Number(rawStatus);
  return Number.isFinite(status) ? status : 0;
}

function isAuthOrPermissionFailure(status, message) {
  return status === 401
    || status === 403
    || /401|403|permission|authorization|unauthorized|forbidden/iu.test(String(message || ''));
}

function storeDashboardShadowDiff(report) {
  if (typeof window === 'undefined') return;
  const key = '__logisticsDashboardShadowDiffs';
  const current = Array.isArray(window[key]) ? window[key] : [];
  window[key] = [...current.slice(-49), report];
}

function dashboardReadRuntimeMode() {
  if (typeof window === 'undefined') return DASHBOARD_READ_MODE;
  const queryMode = new URLSearchParams(window.location.search).get('dashboardReadMode');
  const storedMode = window.localStorage.getItem('logisticsDashboardReadMode');
  return queryMode || storedMode || DASHBOARD_READ_MODE;
}

function isDashboardReadPrimaryMode(mode) {
  return mode === 'primary-safe' || mode === 'primary';
}

function dashboardReadResponseStatus(data) {
  return Number(firstDefined(data?.status, data?.status_code, data?.detail?.status, 0) || 0);
}

function dashboardReadInvalidReason(data, expectedBasisDate) {
  if (data?.ok !== true) return data?.message || 'Supabase dashboard read returned an error response';
  if (data.source !== 'supabase') return 'Supabase dashboard read source mismatch';
  if (data.version !== 'll-dashboard-payload-v1') return 'Supabase dashboard read version mismatch';
  if (!data.data) return 'Supabase dashboard read data is missing';
  if (!data.scope) return 'Supabase dashboard read scope is missing';
  if (expectedBasisDate && data.basis_date !== expectedBasisDate) return 'Supabase dashboard read basis date mismatch';
  if (!Array.isArray(data.evidence?.tables)) return 'Supabase dashboard read evidence tables are missing';
  return '';
}

function canUseStaticDashboardFallback(mode, status, message) {
  if (mode === 'primary-safe' || mode === 'primary') return false;
  return status >= 500
    || /timeout|network|failed to fetch|failed to send a request/iu.test(String(message || ''));
}

function dashboardReadCacheKey(action, payloadKey) {
  return `${action}:${payloadKey || '{}'}`;
}

function useDashboardReadBridge(action, payload, staticSummary, adapter, enabled = true) {
  const payloadKey = JSON.stringify(payload || {});
  const summaryKey = JSON.stringify(staticSummary || {});
  const cacheKey = dashboardReadCacheKey(action, payloadKey);
  const [state, setState] = useState(() => {
    const cached = DASHBOARD_READ_CACHE.get(cacheKey);
    return cached
      ? { status: 'primary', payload: cached.payload, raw: cached.raw, blocked: false, message: '' }
      : { status: 'idle', payload: null, raw: null, blocked: false, message: '' };
  });
  const mode = dashboardReadRuntimeMode();
  const primaryMode = isDashboardReadPrimaryMode(mode);

  useEffect(() => {
    if (!enabled || mode === 'off') {
      setState({ status: 'idle', payload: null, raw: null, blocked: false, message: '' });
      return undefined;
    }
    let cancelled = false;
    const runDashboardRead = async () => {
      const requestPayload = JSON.parse(payloadKey || '{}');
      const expectedSummary = JSON.parse(summaryKey || '{}');
      if (primaryMode) setState((current) => ({
        status: 'loading',
        payload: current.payload || DASHBOARD_READ_CACHE.get(cacheKey)?.payload || null,
        raw: current.raw || DASHBOARD_READ_CACHE.get(cacheKey)?.raw || null,
        blocked: false,
        message: '',
      }));
      try {
        const { data, error } = await supabase.functions.invoke('ll-dashboard-api', {
          body: { action, payload: requestPayload },
        });
        if (error) throw error;
        const expectedBasisDate = String(firstDefined(requestPayload.basis_date, requestPayload.basisDate, '') || '');
        const invalidReason = dashboardReadInvalidReason(data, expectedBasisDate);
        if (invalidReason) {
          const status = dashboardReadResponseStatus(data);
          const message = invalidReason;
          const authFailure = isAuthOrPermissionFailure(status, message);
          const fallbackAllowed = !authFailure && canUseStaticDashboardFallback(mode, status, message);
          const report = {
            action,
            mode,
            ok: false,
            status: status || undefined,
            fallback_allowed: fallbackAllowed,
            message,
            checked_at: new Date().toISOString(),
          };
          if (!cancelled) {
            storeDashboardShadowDiff(report);
            setState((current) => ({
              status: fallbackAllowed ? 'fallback' : 'blocked',
              payload: fallbackAllowed ? current.payload : null,
              raw: data || null,
              blocked: !fallbackAllowed,
              message,
            }));
          }
          return;
        }
        const adapted = adapter?.(data) || {};
        if (!adapted.payload) throw new Error('Dashboard adapter did not return a payload');
        const serverSummary = adapted.summary || data?.data?.summary || {};
        const diffs = Object.fromEntries(Object.keys(expectedSummary).map((key) => [
          key,
          {
            static_value: expectedSummary[key],
            supabase_value: serverSummary[key],
            diff: numericDiff(expectedSummary[key], serverSummary[key]),
          },
        ]));
        const report = {
          action,
          mode,
          ok: true,
          source: data.source,
          basis_date: data.basis_date,
          scope_hash: data.scope?.scope_hash,
          readable_asset_count: data.scope?.readable_asset_ids?.length,
          diffs,
          evidence: data.evidence,
          warnings: data.warnings || adapted.warnings || [],
          checked_at: new Date().toISOString(),
        };
        if (!cancelled) {
          storeDashboardShadowDiff(report);
          DASHBOARD_READ_CACHE.set(cacheKey, { payload: adapted.payload, raw: data, checkedAt: report.checked_at });
          setState({
            status: primaryMode ? 'primary' : 'preview',
            payload: primaryMode ? adapted.payload : null,
            raw: data,
            blocked: false,
            message: '',
          });
        }
      } catch (error) {
        const status = edgeErrorStatus(error);
        const message = error?.message || 'Supabase dashboard read failed';
        const authFailure = isAuthOrPermissionFailure(status, message);
        const fallbackAllowed = !authFailure && canUseStaticDashboardFallback(mode, status, message);
        const report = {
          action,
          mode,
          ok: false,
          status: status || undefined,
          fallback_allowed: fallbackAllowed,
          message,
          checked_at: new Date().toISOString(),
        };
        if (!cancelled) {
          storeDashboardShadowDiff(report);
          setState((current) => ({
            status: fallbackAllowed ? 'fallback' : 'blocked',
            payload: fallbackAllowed ? current.payload : null,
            raw: null,
            blocked: !fallbackAllowed,
            message,
          }));
        }
      }
    };
    runDashboardRead();
    return () => {
      cancelled = true;
    };
  }, [action, enabled, mode, payloadKey, primaryMode, summaryKey, adapter, cacheKey]);

  return {
    ...state,
    mode,
    primaryMode,
    loading: primaryMode && enabled && (state.status === 'idle' || state.status === 'loading'),
    fallbackAllowed: !primaryMode || state.status === 'fallback' || state.status === 'preview',
  };
}

function DashboardAccessState({ title, message }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <div className="rounded-[20px] border border-[#3A3A3C] bg-[#1F1F1E] p-5 text-[#D1D1D6]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[16px] font-bold">{title}</div>
          <div className="mt-2 text-[13px] leading-5">{message}</div>
        </div>
        <button
          type="button"
          aria-label="메시지 닫기"
          onClick={() => setDismissed(true)}
          className="h-8 w-8 shrink-0 rounded-[8px] border border-[#3A3A3C] bg-[#252524] text-[18px] leading-none text-[#C7C7CC] hover:bg-[#30302F] hover:text-white"
        >
          ×
        </button>
      </div>
    </div>
  );
}

function camelAssetFromApi(row = {}) {
  return {
    assetId: firstDefined(row.asset_id, row.assetId),
    assetCode: firstDefined(row.asset_code, row.assetCode),
    assetName: firstDefined(row.asset_name, row.assetName, '-'),
    fundCode: firstDefined(row.fund_code, row.fundCode),
    fundName: firstDefined(row.fund_name, row.fundName),
    sector: row.sector,
    address: firstDefined(row.address, row.standardizedAddress),
    standardizedAddress: firstDefined(row.address, row.standardizedAddress),
    latitude: row.latitude,
    longitude: row.longitude,
    grossFloorAreaSqm: firstDefined(row.gross_floor_area_sqm, row.grossFloorAreaSqm),
    landAreaSqm: firstDefined(row.land_area_sqm, row.landAreaSqm),
    floorCount: firstDefined(row.floor_count, row.floorCount),
    sourceSheetRowId: firstDefined(row.source_sheet_row_id, row.sourceSheetRowId),
    reviewStatus: firstDefined(row.review_status, row.reviewStatus),
  };
}

function camelLeaseSpaceFromApi(row = {}, asset = {}, fallback = {}) {
  const leasedAreaSqm = firstDefined(row.leased_area_sqm, row.leasedAreaSqm, fallback.leasedAreaSqm);
  const monthlyRentTotal = firstDefined(row.current_monthly_rent_total, row.currentMonthlyRentTotal, fallback.currentMonthlyRentTotal, fallback.monthlyRentTotal);
  const monthlyMfTotal = firstDefined(row.current_monthly_mf_total, row.currentMonthlyMfTotal, fallback.currentMonthlyMfTotal, fallback.monthlyMfTotal);
  const monthlyCostTotal = firstDefined(row.current_monthly_cost_total, row.currentMonthlyCostTotal, fallback.monthlyCostTotal, Number(monthlyRentTotal || 0) + Number(monthlyMfTotal || 0));
  const floorLabel = firstDefined(row.floor_label, row.floorLabel, fallback.floorLabel);
  const detailAreaLabel = firstDefined(row.detail_area_label, row.detailAreaLabel, fallback.detailAreaLabel);
  const tenantDisplayName = firstHumanTenantName(
    row.tenant_master_name,
    row.company_name,
    row.raw_tenant_name,
    row.tenantName,
    row.companyName,
    fallback.tenantMasterName,
    fallback.tenantName,
    fallback.companyName,
    fallback.rawTenantName,
    fallback.raw_tenant_name,
  );
  return {
    ...fallback,
    leaseSpaceId: firstDefined(row.lease_space_id, row.leaseSpaceId, fallback.leaseSpaceId),
    leaseId: firstDefined(row.lease_id, row.leaseId, fallback.leaseId),
    assetId: firstDefined(row.asset_id, row.assetId, asset.assetId, fallback.assetId),
    assetName: firstDefined(asset.assetName, fallback.assetName, '-'),
    fundName: firstDefined(asset.fundName, fallback.fundName),
    address: firstDefined(asset.address, fallback.address),
    latitude: firstDefined(asset.latitude, fallback.latitude),
    longitude: firstDefined(asset.longitude, fallback.longitude),
    tenantId: firstDefined(row.tenant_id, row.tenantId, fallback.tenantId),
    tenantMasterName: tenantDisplayName || '-',
    rawTenantName: firstDefined(fallback.rawTenantName, fallback.raw_tenant_name),
    companyName: firstDefined(
      row.company_name,
      row.companyName,
      row.tenant_master_name,
      row.tenantName,
      fallback.companyName,
      fallback.tenantMasterName,
      fallback.tenantName,
      tenantDisplayName,
    ),
    businessRegistrationNo: firstDefined(fallback.businessRegistrationNo, fallback.business_registration_no),
    floorLabel,
    detailAreaLabel,
    spaceLabel: [floorLabel, detailAreaLabel].filter(Boolean).join(' / ') || fallback.spaceLabel || '-',
    coldStorageType: normalizeColdStorageLabel(firstDefined(row.temperature_type, row.temperatureType, fallback.coldStorageType)),
    temperatureType: firstDefined(row.temperature_type, row.temperatureType, fallback.temperatureType),
    goodsType: firstDefined(row.goods_type, row.goodsType, fallback.goodsType),
    leasedAreaSqm,
    exclusiveAreaSqm: firstDefined(row.exclusive_area_sqm, row.exclusiveAreaSqm, fallback.exclusiveAreaSqm),
    exclusiveRatio: firstDefined(row.exclusive_ratio, row.exclusiveRatio, fallback.exclusiveRatio),
    currentMonthlyRentTotal: monthlyRentTotal,
    currentMonthlyMfTotal: monthlyMfTotal,
    monthlyRentTotal,
    monthlyMfTotal,
    monthlyCostTotal,
    monthlyCombinedTotal: monthlyCostTotal,
    currentMonthlyCostTotal: monthlyCostTotal,
    eNoc: firstDefined(row.e_noc, row.eNoc, fallback.eNoc),
    currentStartDate: firstDefined(fallback.currentStartDate, fallback.current_start_date),
    currentEndDate: firstDefined(fallback.currentEndDate, fallback.current_end_date, fallback.latestExpiry),
    latestExpiry: firstDefined(fallback.latestExpiry, fallback.currentEndDate, fallback.current_end_date),
    firstContractDate: firstDefined(fallback.firstContractDate, fallback.first_contract_date),
    firstStartDate: firstDefined(fallback.firstStartDate, fallback.first_start_date),
    firstEndDate: firstDefined(fallback.firstEndDate, fallback.first_end_date),
    recentContractDate: firstDefined(fallback.recentContractDate, fallback.recent_contract_date),
    contractYears: firstDefined(fallback.contractYears, fallback.contract_years),
    extensionCount: firstDefined(fallback.extensionCount, fallback.extension_count),
    depositAmount: firstDefined(fallback.depositAmount, fallback.deposit_amount),
    rfMonths: firstDefined(fallback.rfMonths, fallback.rf_months),
    foMonths: firstDefined(fallback.foMonths, fallback.fo_months),
    tiAmount: firstDefined(fallback.tiAmount, fallback.ti_amount),
    rentEscalationRate: firstDefined(fallback.rentEscalationRate, fallback.rent_escalation_rate),
    managementFeeEscalationRate: firstDefined(fallback.managementFeeEscalationRate, fallback.management_fee_escalation_rate),
    nextEscalationDate: firstDefined(fallback.nextEscalationDate, fallback.next_escalation_date),
    tenantCostBurden: firstDefined(fallback.tenantCostBurden, fallback.tenant_cost_burden),
    earlyTerminationRight: firstDefined(fallback.earlyTerminationRight, fallback.early_termination_right),
    renewalOption: firstDefined(fallback.renewalOption, fallback.renewal_option),
    calculatedReviewStatus: reviewStatusLabel(firstDefined(row.review_status, row.reviewStatus, fallback.reviewStatus)),
    sourceSheetRowId: firstDefined(row.source_sheet_row_id, row.sourceSheetRowId, fallback.sourceSheetRowId),
    reviewStatus: firstDefined(row.review_status, row.reviewStatus, fallback.reviewStatus),
  };
}

function generalRowsFromDashboardReadData(readData = {}, fallbackRows = []) {
  const assetsById = new Map((readData.assets || []).map((row) => {
    const asset = camelAssetFromApi(row);
    return [asset.assetId, asset];
  }));
  const leasesById = new Map((readData.leases || []).map((row) => [firstDefined(row.lease_id, row.leaseId), row]));
  const tenantsById = new Map((readData.tenants || []).map((row) => [firstDefined(row.tenant_id, row.tenantId), row]));
  const fallbackByLeaseSpaceId = new Map((fallbackRows || []).map((row) => [row.leaseSpaceId, row]));
  return filterCurrentDashboardLeaseRows(readData.lease_spaces || []).map((row) => {
    const lease = leasesById.get(firstDefined(row.lease_id, row.leaseId)) || {};
    const tenantId = firstDefined(row.tenant_id, row.tenantId, lease.tenant_id, lease.tenantId);
    const tenant = tenantsById.get(tenantId) || {};
    const fallback = {
      ...(fallbackByLeaseSpaceId.get(firstDefined(row.lease_space_id, row.leaseSpaceId)) || {}),
      ...lease,
      tenantId,
      tenantMasterName: firstDefined(tenant.tenant_master_name, tenant.company_name, tenant.raw_tenant_name),
      rawTenantName: tenant.raw_tenant_name,
      companyName: firstDefined(tenant.company_name, tenant.tenant_master_name),
      businessRegistrationNo: tenant.business_registration_no,
      dartCorpCode: tenant.dart_corp_code,
      currentStartDate: lease.current_start_date,
      currentEndDate: lease.current_end_date,
      latestExpiry: lease.current_end_date,
    };
    const asset = assetsById.get(firstDefined(row.asset_id, row.assetId)) || {};
    return camelLeaseSpaceFromApi(row, asset, fallback);
  });
}

function kpisFromDashboardSummary(summary = {}) {
  return [
    { key: 'operating_asset_count', label: '운영 자산 수', value: summary.operating_asset_count, valueType: 'number' },
    { key: 'gross_floor_area_total', label: '총 연면적', value: summary.gross_floor_area_sqm, valueType: 'area' },
    { key: 'leased_area_total', label: '총 임대면적', value: summary.leased_area_sqm, valueType: 'area' },
    { key: 'monthly_rent_total', label: '월 임대료 총액', value: summary.current_monthly_rent_total, valueType: 'currency' },
    { key: 'monthly_mf_total', label: '월 관리비 총액', value: summary.current_monthly_mf_total, valueType: 'currency' },
    { key: 'monthly_total_cost', label: '월 임관리비 총액', value: summary.current_monthly_cost_total, valueType: 'currency' },
  ];
}

function areaBreakdownFromDashboardDetails(rows = []) {
  const breakdown = {};
  const setValue = (key, value) => {
    const numeric = Number(value || 0);
    if (!Number.isFinite(numeric)) return;
    breakdown[key] = Number(breakdown[key] || 0) + numeric;
  };
  (rows || []).forEach((row) => {
    const key = String(firstDefined(row.area_type, row.area_label, '') || '').toLowerCase();
    const value = firstDefined(row.area_sqm, row.areaSqm, row.value);
    if (key.startsWith('aa_')) setValue('warehouseAreaSqm', value);
    else if (key.startsWith('ab_')) setValue('dockAreaSqm', value);
    else if (key.startsWith('ac_')) setValue('officeAreaSqm', value);
    else if (key.startsWith('ad_')) setValue('otherExclusiveAreaSqm', value);
    else if (key.startsWith('ae_')) setValue('corridorAreaSqm', value);
    else if (key.startsWith('af_')) setValue('rampAreaSqm', value);
    else if (key.startsWith('ag_')) setValue('mechanicalAreaSqm', value);
    else if (key.startsWith('ah_')) setValue('parkingAreaSqm', value);
    else if (key.startsWith('ai_')) setValue('coreAreaSqm', value);
    else if (key.startsWith('aj_')) setValue('otherCommonAreaSqm', value);
  });
  const exclusiveAreaSqm = Number(breakdown.warehouseAreaSqm || 0)
    + Number(breakdown.dockAreaSqm || 0)
    + Number(breakdown.officeAreaSqm || 0)
    + Number(breakdown.otherExclusiveAreaSqm || 0);
  const commonAreaSqm = Number(breakdown.corridorAreaSqm || 0)
    + Number(breakdown.rampAreaSqm || 0)
    + Number(breakdown.mechanicalAreaSqm || 0)
    + Number(breakdown.parkingAreaSqm || 0)
    + Number(breakdown.coreAreaSqm || 0)
    + Number(breakdown.otherCommonAreaSqm || 0);
  return {
    ...breakdown,
    exclusiveAreaSqm: exclusiveAreaSqm || undefined,
    commonAreaSqm: commonAreaSqm || undefined,
    grossFloorAreaSqm: exclusiveAreaSqm + commonAreaSqm || undefined,
  };
}

function assetOptionsFromDashboardReadData(readData = {}, fallbackOptions = []) {
  const spaces = filterCurrentDashboardLeaseRows(readData.lease_spaces || []);
  return (readData.assets || []).map((rawAsset) => {
    const asset = camelAssetFromApi(rawAsset);
    const fallback = fallbackOptions.find((row) => row.assetId === asset.assetId || normalizeAssetNameKey(row.assetName) === normalizeAssetNameKey(asset.assetName)) || {};
    const assetSpaces = spaces.filter((row) => firstDefined(row.asset_id, row.assetId) === asset.assetId);
    const leasedAreaSqm = sumRows(assetSpaces, (row) => firstDefined(row.leased_area_sqm, row.leasedAreaSqm));
    const monthlyCostTotal = sumRows(assetSpaces, (row) => firstDefined(row.current_monthly_cost_total, row.currentMonthlyCostTotal));
    const grossFloorAreaSqm = Number(firstDefined(asset.grossFloorAreaSqm, fallback.grossFloorAreaSqm, 0) || 0);
    return {
      ...fallback,
      ...asset,
      assetId: asset.assetId,
      assetName: asset.assetName,
      fundName: firstDefined(asset.fundName, fallback.fundName),
      grossFloorAreaSqm,
      leasedAreaSqm,
      vacancyAreaSqm: Math.max(0, grossFloorAreaSqm - Number(leasedAreaSqm || 0)),
      vacancyRate: grossFloorAreaSqm > 0 ? Math.max(0, grossFloorAreaSqm - Number(leasedAreaSqm || 0)) / grossFloorAreaSqm : fallback.vacancyRate,
      monthlyCostTotal,
      uniqueTenantCount: new Set(assetSpaces.map((row) => firstDefined(row.tenant_id, row.tenantId)).filter(Boolean)).size,
      averageENoc: calculateWeightedENoc(assetSpaces.map((row) => camelLeaseSpaceFromApi(row, asset)), fallback.averageENoc),
    };
  });
}

function monthKeyFromDate(value) {
  const text = String(value || '').trim();
  if (/^\d{4}-\d{2}/u.test(text)) return text.slice(0, 7);
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return '';
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
}

function dashboardRentHistoryComponentKey(row = {}) {
  const areaKey = (value) => {
    const numeric = Number(String(value ?? '').replace(/,/g, '').replace(/[^\d.-]/g, ''));
    return Number.isFinite(numeric) && numeric ? String(Math.round(numeric)) : '';
  };
  return [
    firstDefined(row.asset_id, row.assetId),
    firstDefined(row.tenant_id, row.tenantId),
    firstDefined(row.source_contract_lease_space_id, row.sourceContractLeaseSpaceId, row.lease_space_id, row.leaseSpaceId),
    firstDefined(row.floor_label, row.floorLabel),
    firstDefined(row.detail_area_label, row.detailAreaLabel),
    firstDefined(row.temperature_type, row.temperatureType, row.coldStorageType),
    areaKey(firstDefined(row.leased_area_sqm, row.leasedAreaSqm)),
    areaKey(firstDefined(row.exclusive_area_sqm, row.exclusiveAreaSqm)),
  ].map((value) => String(value || '').trim()).join('|');
}

function buildRentTrendRowsFromDashboardReadData(readData = {}) {
  const rentRows = (readData.rent_history || [])
    .map((row) => ({
      ...row,
      month: monthKeyFromDate(row.effective_date),
      leaseSpaceId: firstDefined(row.lease_space_id, row.leaseSpaceId),
      rentComponentKey: dashboardRentHistoryComponentKey(row),
      assetId: firstDefined(row.asset_id, row.assetId),
      monthlyRentTotal: Number(firstDefined(row.monthly_rent_total, row.monthlyRentTotal, 0) || 0),
      monthlyMfTotal: Number(firstDefined(row.monthly_mf_total, row.monthlyMfTotal, 0) || 0),
      leasedAreaSqm: Number(firstDefined(row.leased_area_sqm, row.leasedAreaSqm, 0) || 0),
    }))
    .filter((row) => row.month && row.rentComponentKey);
  const monthKeys = [...new Set(rentRows.map((row) => row.month))].sort();
  const assetById = new Map((readData.assets || []).map((row) => [firstDefined(row.asset_id, row.assetId), camelAssetFromApi(row)]));
  const firstAssetMonth = new Map();
  rentRows.forEach((row) => {
    if (!row.assetId) return;
    const current = firstAssetMonth.get(row.assetId);
    if (!current || row.month < current) firstAssetMonth.set(row.assetId, row.month);
  });
  return monthKeys.map((month) => {
    const activeBySpace = new Map();
    rentRows
      .filter((row) => row.month <= month)
      .sort((a, b) => {
        const dateCompare = String(a.month).localeCompare(String(b.month));
        if (dateCompare !== 0) return dateCompare;
        const costA = Number(a.monthlyRentTotal || 0) + Number(a.monthlyMfTotal || 0);
        const costB = Number(b.monthlyRentTotal || 0) + Number(b.monthlyMfTotal || 0);
        if (costA !== costB) return costA - costB;
        return String(firstDefined(a.source_sheet_row_id, a.sourceSheetRowId)).localeCompare(String(firstDefined(b.source_sheet_row_id, b.sourceSheetRowId)));
      })
      .forEach((row) => activeBySpace.set(row.rentComponentKey, row));
    const activeRows = [...activeBySpace.values()];
    const activeAssetIds = new Set(activeRows.map((row) => row.assetId).filter(Boolean));
    const newlyAddedAssets = [...activeAssetIds]
      .filter((assetId) => firstAssetMonth.get(assetId) === month)
      .map((assetId) => assetById.get(assetId)?.assetName || assetId);
    const monthlyRentTotal = sumRows(activeRows, (row) => row.monthlyRentTotal);
    const monthlyMfTotal = sumRows(activeRows, (row) => row.monthlyMfTotal);
    const grossFloorAreaSqm = [...activeAssetIds].reduce((sum, assetId) => sum + Number(assetById.get(assetId)?.grossFloorAreaSqm || 0), 0);
    return {
      month,
      monthlyRentTotal,
      monthlyMfTotal,
      monthlyTotal: monthlyRentTotal + monthlyMfTotal,
      monthlyRentTotalAdjusted: monthlyRentTotal,
      monthlyMfTotalAdjusted: monthlyMfTotal,
      monthlyCostTotalAdjusted: monthlyRentTotal + monthlyMfTotal,
      leasedAreaSqm: sumRows(activeRows, (row) => row.leasedAreaSqm),
      activeAssetCount: activeAssetIds.size,
      contractActiveAssetCount: activeAssetIds.size,
      grossFloorAreaSqm,
      newlyAddedAssets,
      newlyAddedAssetCount: newlyAddedAssets.length,
      knownLeaseSpaceCount: activeRows.length,
      source: 'dashboard/home/read:ll_rent_history',
    };
  });
}

function buildMonthlyExpirySeriesFromGeneralRows(rows = []) {
  const grouped = new Map();
  (rows || []).forEach((row) => {
    const expiryDate = firstDefined(row.currentEndDate, row.latestExpiry, row.endDate);
    const month = monthKeyFromDate(expiryDate);
    if (!month) return;
    if (!grouped.has(month)) {
      grouped.set(month, {
        label: month,
        month,
        count: 0,
        contractCount: 0,
        uniqueTenantIds: new Set(),
        expiringAreaSqm: 0,
        monthlyRentTotal: 0,
        monthlyMfTotal: 0,
        monthlyCostTotal: 0,
        items: [],
      });
    }
    const group = grouped.get(month);
    const monthlyRentTotal = Number(firstDefined(row.currentMonthlyRentTotal, row.monthlyRentTotal, 0) || 0);
    const monthlyMfTotal = Number(firstDefined(row.currentMonthlyMfTotal, row.monthlyMfTotal, 0) || 0);
    group.count += 1;
    group.contractCount += 1;
    if (row.tenantId || row.tenantMasterName) group.uniqueTenantIds.add(row.tenantId || row.tenantMasterName);
    group.expiringAreaSqm += Number(row.leasedAreaSqm || 0);
    group.monthlyRentTotal += monthlyRentTotal;
    group.monthlyMfTotal += monthlyMfTotal;
    group.monthlyCostTotal += Number(firstDefined(row.monthlyCostTotal, row.monthlyCombinedTotal, monthlyRentTotal + monthlyMfTotal, 0) || 0);
    group.items.push({
      ...row,
      monthlyRentTotal,
      monthlyMfTotal,
      monthlyCostTotal: Number(firstDefined(row.monthlyCostTotal, row.monthlyCombinedTotal, monthlyRentTotal + monthlyMfTotal, 0) || 0),
      rentPerPy: firstDefined(row.currentRentPerPy, row.rentPerPy),
      mfPerPy: firstDefined(row.currentMfPerPy, row.mfPerPy),
      eNoc: firstDefined(row.eNoc, calculatePerPy(firstDefined(row.monthlyCostTotal, row.monthlyCombinedTotal, monthlyRentTotal + monthlyMfTotal), row.leasedAreaSqm)),
    });
  });
  return [...grouped.values()]
    .sort((a, b) => String(a.month).localeCompare(String(b.month)))
    .map((row) => ({
      ...row,
      uniqueTenantCount: row.uniqueTenantIds.size,
      uniqueTenantIds: undefined,
    }));
}

function homePayloadFromDashboardRead(response, fallbackHome, fallbackRows = []) {
  const readData = response?.data || {};
  const summary = readData.summary || {};
  const assetOptions = assetOptionsFromDashboardReadData(readData, assetOptionsData);
  const generalRows = generalRowsFromDashboardReadData(readData, fallbackRows);
  const tenantGroups = buildTenantContractGroups(generalRows);
  const monthlyExpirySeries = buildMonthlyExpirySeriesFromGeneralRows(generalRows);
  const rentTrend = buildRentTrendRowsFromDashboardReadData(readData);
  const topContracts = tenantGroups
    .slice()
    .sort((a, b) => Number(b.monthlyCostTotal || 0) - Number(a.monthlyCostTotal || 0))
    .slice(0, 20);
  const topTenants = topContracts.map((row) => ({
    ...row,
    monthlyCombinedTotal: row.monthlyCostTotal,
  }));
  const mapPoints = assetOptions.map((asset) => ({
    assetId: asset.assetId,
    assetName: asset.assetName,
    address: asset.address,
    latitude: asset.latitude,
    longitude: asset.longitude,
    grossFloorAreaSqm: asset.grossFloorAreaSqm,
    vacancyAreaSqm: asset.vacancyAreaSqm,
    vacancyRate: asset.vacancyRate,
  }));
  const vacancySummary = assetOptions.map((asset) => ({
    assetId: asset.assetId,
    assetName: asset.assetName,
    address: asset.address,
    grossFloorAreaSqm: asset.grossFloorAreaSqm,
    leasedAreaSqm: asset.leasedAreaSqm,
    vacancyAreaSqm: asset.vacancyAreaSqm,
    vacancyRate: asset.vacancyRate,
  }));
  return {
    payload: {
      meta: fallbackHome?.meta,
      basis: fallbackHome?.basis,
      generatedAt: response?.checked_at || new Date().toISOString(),
      basisDisplay: fallbackHome?.basisDisplay,
      payloadSource: 'dashboard/home/read',
      dataSourceMode: 'supabase-primary-safe',
      sourceSystem: 'Supabase ll_* read API',
      kpis: kpisFromDashboardSummary(summary),
      mapPoints,
      vacancySummary,
      topContracts,
      topTenants,
      contractSummary: {
        monthlyExpirySeries,
        monthlyVacancy: monthlyExpirySeries,
        upcoming: monthlyExpirySeries.flatMap((row) => row.items || []).slice(0, 20),
        tenantCount: tenantGroups.length,
      },
      rentTrend,
      composition: {
        coldStorage: mergeUseCategoryRows(assetOptions.map((asset) => {
          const assetRows = generalRows.filter((row) => row.assetId === asset.assetId || normalizeAssetNameKey(row.assetName) === normalizeAssetNameKey(asset.assetName));
          return buildUseCategoryRows({ rows: assetRows, overview: asset }, asset, {});
        })),
      },
      __supabaseGeneralRows: generalRows,
      __supabaseAssetOptions: assetOptions,
      __dashboardRead: response,
    },
    summary,
  };
}

function companyOptionsFromDashboardRows(rows = [], fallbackOptions = []) {
  const fallbackById = new Map((fallbackOptions || []).map((item) => [String(item.tenantId || ''), item]));
  const fallbackByName = new Map((fallbackOptions || []).map((item) => [normalizeAssetNameKey(item.tenantMasterName), item]));
  const grouped = new Map();
  (rows || []).forEach((row) => {
    const tenantId = String(firstDefined(row.tenantId, row.tenant_id, row.tenantMasterName, row.companyName, '') || '').trim();
    const tenantMasterName = cleanDisplay(firstDefined(row.tenantMasterName, row.tenant_master_name, row.companyName, row.rawTenantName), '');
    if (!tenantId || !tenantMasterName || tenantMasterName === '-') return;
    const fallback = fallbackById.get(tenantId) || fallbackByName.get(normalizeAssetNameKey(tenantMasterName)) || {};
    const key = String(firstDefined(fallback.tenantId, tenantId));
    if (grouped.has(key)) return;
    grouped.set(key, {
      ...fallback,
      tenantId: key,
      tenantMasterName,
      displayName: tenantMasterName,
      companyName: firstDefined(row.companyName, fallback.companyName, tenantMasterName),
      businessRegistrationNo: firstDefined(row.businessRegistrationNo, fallback.businessRegistrationNo),
      dartCorpCode: firstDefined(row.dartCorpCode, fallback.dartCorpCode),
    });
  });
  return [...grouped.values()].sort((a, b) => String(a.tenantMasterName || '').localeCompare(String(b.tenantMasterName || ''), 'ko-KR'));
}

function useDashboardHomeReadDataset(memberInfo, enabled = true) {
  const staticHomeData = useMemo(() => normalizeHomeData(homeData), []);
  const staticGeneralRows = useMemo(() => buildLogisticsGeneralRows(), []);
  const homeReadAdapter = useMemo(() => (
    (response) => homePayloadFromDashboardRead(response, homeData, staticGeneralRows)
  ), [staticGeneralRows]);
  const homeRead = useDashboardReadBridge('dashboard/home/read', { basis_date: DASHBOARD_BASIS_DATE }, {
    operating_asset_count: staticHomeData.operatingAssetCount,
    leased_area_sqm: staticHomeData.leasedArea,
    current_monthly_cost_total: staticHomeData.monthlyCost,
  }, homeReadAdapter, enabled && Boolean(memberInfo));
  const blocked = homeRead.blocked === true;
  const payload = useMemo(() => (
    homeRead.payload || (blocked ? {
      kpis: [],
      mapPoints: [],
      vacancySummary: [],
      __supabaseGeneralRows: [],
      __supabaseAssetOptions: [],
    } : homeData)
  ), [blocked, homeRead.payload]);
  const generalRows = useMemo(() => (
    blocked ? [] : payload.__supabaseGeneralRows || staticGeneralRows
  ), [blocked, payload, staticGeneralRows]);
  const assetOptions = useMemo(() => (
    blocked ? [] : payload.__supabaseAssetOptions || assetOptionsData
  ), [blocked, payload]);
  const companyOptions = useMemo(() => {
    if (blocked) return [];
    const fromRows = companyOptionsFromDashboardRows(generalRows, companyOptionsData);
    if (homeRead.payload) return fromRows;
    return fromRows.length ? fromRows : companyOptionsData;
  }, [blocked, generalRows, homeRead.payload]);
  return {
    read: homeRead,
    payload,
    generalRows,
    assetOptions,
    companyOptions,
    blocked,
    loading: homeRead.loading,
  };
}

function assetPayloadFromDashboardRead(response, fallbackPayload = {}) {
  const readData = response?.data || {};
  const summary = readData.summary || {};
  const asset = camelAssetFromApi(readData.asset || {});
  const fallbackNormalized = normalizeAssetPayload(fallbackPayload || {});
  const rows = generalRowsFromDashboardReadData({
    assets: readData.asset ? [readData.asset] : [],
    leases: readData.leases || [],
    tenants: readData.tenants || [],
    lease_spaces: readData.lease_spaces || [],
  }, fallbackNormalized.normalizedRows || fallbackPayload.rows || []);
  const expiryRows = buildExpiryRowsFromRows(rows);
  const grossFloorAreaSqm = firstDefined(summary.gross_floor_area_sqm, asset.grossFloorAreaSqm, fallbackNormalized.overview?.grossFloorAreaSqm);
  const leasedAreaSqm = firstDefined(summary.leased_area_sqm, fallbackNormalized.overview?.leasedAreaSqm);
  const vacancyAreaSqm = Math.max(0, Number(grossFloorAreaSqm || 0) - Number(leasedAreaSqm || 0));
  const monthlyRentTotal = firstDefined(summary.current_monthly_rent_total, fallbackNormalized.overview?.monthlyRentTotal);
  const monthlyMfTotal = firstDefined(summary.current_monthly_mf_total, fallbackNormalized.overview?.monthlyMfTotal);
  const monthlyCostTotal = firstDefined(summary.current_monthly_cost_total, fallbackNormalized.overview?.monthlyCostTotal);
  const tenantGroups = buildTenantContractGroups(rows);
  const detailAreaBreakdown = areaBreakdownFromDashboardDetails(readData.lease_space_area_breakdowns || []);
  return {
    payload: {
      ...fallbackPayload,
      overview: {
        ...(fallbackPayload.overview || {}),
        ...asset,
        areaBreakdown: {
          ...(fallbackPayload.overview?.areaBreakdown || fallbackPayload.areaBreakdown || {}),
          ...detailAreaBreakdown,
        },
        grossFloorAreaSqm,
        leasedAreaSqm,
        vacancyAreaSqm,
        vacancyRate: Number(grossFloorAreaSqm || 0) > 0 ? vacancyAreaSqm / Number(grossFloorAreaSqm || 0) : fallbackNormalized.overview?.vacancyRate,
        monthlyRentTotal,
        monthlyMfTotal,
        monthlyCostTotal,
        uniqueTenantCount: tenantGroups.length,
        averageENoc: calculateWeightedENoc(rows, fallbackNormalized.overview?.averageENoc),
      },
      rows,
      areaBreakdown: {
        ...(fallbackPayload.areaBreakdown || {}),
        ...detailAreaBreakdown,
      },
      leaseSpaceSpecs: readData.lease_space_specs || fallbackPayload.leaseSpaceSpecs || [],
      leaseSpecialTerms: readData.lease_special_terms || fallbackPayload.leaseSpecialTerms || [],
      kpis: [
        { key: 'gross_floor_area_total', label: '총 연면적', value: grossFloorAreaSqm, valueType: 'area' },
        { key: 'leased_area_total', label: '총 임대면적', value: leasedAreaSqm, valueType: 'area' },
        { key: 'vacancy_area_total', label: '공실면적', value: vacancyAreaSqm, valueType: 'area' },
        { key: 'monthly_total_cost', label: '월 임관리비 총액', value: monthlyCostTotal, valueType: 'currency' },
        { key: 'average_e_noc', label: 'E. NOC', value: calculateWeightedENoc(rows, fallbackNormalized.overview?.averageENoc), valueType: 'won' },
        { key: 'unique_tenant_count', label: '현재 임차인 수', value: tenantGroups.length, valueType: 'count' },
      ],
      analytics: {
        ...(fallbackPayload.analytics || {}),
        rentVsMf: rows.map((row) => ({
          leaseSpaceId: row.leaseSpaceId,
          monthlyRentTotal: row.currentMonthlyRentTotal,
          monthlyMfTotal: row.currentMonthlyMfTotal,
          monthlyTotal: row.monthlyCostTotal,
          rentPerPy: row.currentRentPerPy,
          mfPerPy: row.currentMfPerPy,
        })),
        contractExpiry: expiryRows,
        expirySnapshot: { entries: expiryRows },
        uniqueTenants: tenantGroups,
        monthlyCostByTenant: tenantGroups.map((row) => ({
          tenantMasterName: row.tenantMasterName,
          value: row.monthlyCostTotal,
          monthlyCostTotal: row.monthlyCostTotal,
        })),
      },
      fundOverview: readData.fund_overview || fallbackPayload.fundOverview,
      __dashboardRead: response,
    },
    summary,
  };
}

function companyPayloadFromDashboardRead(response, fallbackPayload = {}) {
  const readData = response?.data || {};
  const summary = readData.summary || {};
  const fallbackCompany = normalizeCompanyPayload(fallbackPayload || {});
  const tenant = readData.tenant || {};
  const rows = generalRowsFromDashboardReadData(readData, fallbackCompany.normalizedLeasedAssets || []).map((row) => ({
    ...row,
    tenantId: firstDefined(row.tenantId, tenant.tenant_id),
    tenantMasterName: firstDefined(tenant.tenant_master_name, tenant.company_name, row.tenantMasterName),
    companyName: firstDefined(tenant.company_name, tenant.tenant_master_name, row.companyName),
    businessRegistrationNo: firstDefined(tenant.business_registration_no, row.businessRegistrationNo),
  }));
  const exposureRows = Object.values(rows.reduce((acc, row) => {
    const key = row.assetId || row.assetName;
    if (!acc[key]) {
      acc[key] = {
        assetId: row.assetId,
        assetName: row.assetName,
        leasedAreaSqm: 0,
        monthlyRentTotal: 0,
        monthlyMfTotal: 0,
        monthlyCostTotal: 0,
      };
    }
    acc[key].leasedAreaSqm += Number(row.leasedAreaSqm || 0);
    acc[key].monthlyRentTotal += Number(row.currentMonthlyRentTotal || row.monthlyRentTotal || 0);
    acc[key].monthlyMfTotal += Number(row.currentMonthlyMfTotal || row.monthlyMfTotal || 0);
    acc[key].monthlyCostTotal += Number(row.monthlyCostTotal || 0);
    return acc;
  }, {}));
  const mapPoints = (readData.assets || []).map((row) => camelAssetFromApi(row)).map((asset) => ({
    assetId: asset.assetId,
    assetName: asset.assetName,
    address: asset.address,
    latitude: asset.latitude,
    longitude: asset.longitude,
  }));
  return {
    payload: {
      ...fallbackPayload,
      profile: {
        ...(fallbackPayload.profile || {}),
        tenantId: firstDefined(tenant.tenant_id, fallbackPayload.profile?.tenantId),
        tenantMasterName: firstDefined(tenant.tenant_master_name, tenant.company_name, fallbackPayload.profile?.tenantMasterName),
        businessRegistrationNo: firstDefined(tenant.business_registration_no, fallbackPayload.profile?.businessRegistrationNo),
        company: {
          ...(fallbackPayload.profile?.company || {}),
          tenantMasterName: firstDefined(tenant.tenant_master_name, tenant.company_name, fallbackPayload.profile?.company?.tenantMasterName),
          businessRegistrationNo: firstDefined(tenant.business_registration_no, fallbackPayload.profile?.company?.businessRegistrationNo),
          dartCorpCode: firstDefined(tenant.dart_corp_code, fallbackPayload.profile?.company?.dartCorpCode),
          representativeName: firstDefined(tenant.representative_name, tenant.ceo_nm, fallbackPayload.profile?.company?.representativeName),
          openingDate: firstDefined(tenant.opening_date, tenant.business_start_date, fallbackPayload.profile?.company?.openingDate),
          establishmentDate: firstDefined(tenant.establishment_date, tenant.est_dt, fallbackPayload.profile?.company?.establishmentDate),
          standardIndustryClassification: firstDefined(tenant.standard_industry_classification, tenant.industry_name, tenant.industry_code, fallbackPayload.profile?.company?.standardIndustryClassification),
          mainProducts: firstDefined(tenant.main_products, tenant.major_products, fallbackPayload.profile?.company?.mainProducts),
          headquartersAddress: firstDefined(tenant.headquarters_address, tenant.address, fallbackPayload.profile?.company?.headquartersAddress),
          latestEmployeeCount: firstDefined(tenant.latest_employee_count, tenant.employee_count, fallbackPayload.profile?.company?.latestEmployeeCount),
          latestFinancialYear: firstDefined(tenant.latest_financial_year, fallbackPayload.profile?.company?.latestFinancialYear),
          latestRevenue: firstDefined(tenant.latest_revenue, fallbackPayload.profile?.company?.latestRevenue),
          latestOperatingIncome: firstDefined(tenant.latest_operating_income, fallbackPayload.profile?.company?.latestOperatingIncome),
          latestNetIncome: firstDefined(tenant.latest_net_income, fallbackPayload.profile?.company?.latestNetIncome),
        },
      },
      leasedAssets: rows,
      rows,
      mapPoints,
      operations: {
        ...(fallbackPayload.operations || {}),
        exposure: {
          ...(fallbackPayload.operations?.exposure || {}),
          byAsset: exposureRows,
        },
      },
      kpis: [
        { key: 'asset_count', label: '임차 자산 수', value: summary.asset_count, valueType: 'number' },
        { key: 'leased_area', label: '총 임차면적', value: summary.leased_area_sqm, valueType: 'area' },
        { key: 'monthly_total_cost', label: '월 임관리비 총액', value: summary.current_monthly_cost_total, valueType: 'currency' },
        { key: 'monthly_rent_total', label: '월 임대료 총액', value: summary.current_monthly_rent_total, valueType: 'currency' },
        { key: 'monthly_mf_total', label: '월 관리비 총액', value: summary.current_monthly_mf_total, valueType: 'currency' },
      ],
      __dashboardRead: response,
    },
    summary,
  };
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
  const [failedAvatarSrc, setFailedAvatarSrc] = useState('');
  const label = String(name || memberInfo?.staff_name || memberInfo?.name || '물류').trim();
  const src = memberAvatarSource(memberInfo, label);
  const defaultAvatarSrc = `${import.meta.env.BASE_URL}default_avatar.svg`;
  const imageSrc = failedAvatarSrc === src ? defaultAvatarSrc : src;
  return (
    <div className={`relative flex ${sizeClass} shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#E8F2FF] ${textClass} font-bold text-[#1F1F1E]`}>
      <img
        src={imageSrc}
        alt={label}
        className="h-full w-full object-cover"
        onError={() => setFailedAvatarSrc(src)}
      />
      <div className="pointer-events-none absolute inset-0 rounded-full border border-white/10" />
    </div>
  );
}

function navigateTo(path) {
  const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL.slice(0, -1) : import.meta.env.BASE_URL;
  window.location.href = String(path || '').startsWith(LOGISTICS_INTERNAL_BASE)
    ? pathForLogisticsUrl(import.meta.env.BASE_URL, path)
    : `${base}/${path}`;
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

function navigateToAsset(assetRef) {
  const rawRef = String(assetRef || '').trim();
  const directAsset = assetOptionsData.find((item) => String(item.assetId || '') === rawRef || String(item.assetCode || '') === rawRef);
  const assetId = directAsset?.assetId || resolveAssetIdByName(rawRef);
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

function isInternalTenantCode(value) {
  const text = cleanDisplay(value, '');
  return /^tenant[_-]/iu.test(text) || /^brn[_-]?\d+/iu.test(text);
}

function firstHumanTenantName(...values) {
  for (const value of values) {
    const text = cleanDisplay(value, '');
    if (text && !isInternalTenantCode(text)) return text;
  }
  return '';
}

function isCurrentDashboardLeaseRow(row = {}) {
  const status = String(firstDefined(row.contract_status, row.contractStatus, '') || '').trim().toLowerCase();
  if (!status) return true;
  if (['active', 'y', 'yes', 'current', 'in_force', 'ongoing'].includes(status)) return true;
  if (['inactive', 'n', 'no', 'false', '0'].includes(status)) return false;
  if (
    status.includes('superseded')
    || status.includes('inactive')
    || status.includes('expired')
    || status.includes('terminated')
    || status.includes('cancelled')
    || status.includes('종료')
    || status.includes('해지')
    || status.includes('만료')
  ) return false;
  return true;
}

function filterCurrentDashboardLeaseRows(rows = []) {
  const byKey = new Map();
  (rows || []).filter(isCurrentDashboardLeaseRow).forEach((row, index) => {
    const key = firstDefined(
      row.lease_space_id,
      row.leaseSpaceId,
      [
        row.asset_id || row.assetId,
        row.tenant_id || row.tenantId,
        row.lease_id || row.leaseId,
        row.floor_label || row.floorLabel,
        row.detail_area_label || row.detailAreaLabel,
        row.temperature_type || row.temperatureType,
      ].map((value) => cleanDisplay(value, '')).join('|'),
      `row-${index}`,
    );
    byKey.set(String(key), row);
  });
  return [...byKey.values()];
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

function normalizeKpiList(kpis) {
  if (Array.isArray(kpis)) return kpis.filter(Boolean);
  if (!kpis || typeof kpis !== 'object') return [];
  return Object.entries(kpis)
    .map(([key, value]) => {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        return {
          key: value.key || key,
          ...value,
        };
      }
      return {
        key,
        label: key,
        value,
      };
    })
    .filter(Boolean);
}

function kpiLookupFrom(kpis) {
  return Object.fromEntries(normalizeKpiList(kpis).map((item) => [item.key, item]));
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

function formatSignedArea(value) {
  if (value === undefined || value === null || value === '') return '-';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '-';
  if (Math.abs(numeric) < 0.5) return '0.0평';
  const prefix = numeric > 0 ? '+' : '-';
  return `${prefix}${formatDecimalNumber(Math.abs(numeric) * 0.3025, 1)}평`;
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

function assetOptionKey(asset = {}) {
  return String(firstDefined(asset.assetId, asset.asset_id, normalizeAssetNameKey(asset.assetName), '') || '');
}

function buildBuildingRegisterRefreshTargets(assetOptions = [], generalRows = []) {
  const rowsByAssetId = new Map();
  const rowsByAssetName = new Map();
  (generalRows || []).forEach((row) => {
    if (row.assetId) {
      if (!rowsByAssetId.has(row.assetId)) rowsByAssetId.set(row.assetId, []);
      rowsByAssetId.get(row.assetId).push(row);
    }
    const nameKey = normalizeAssetNameKey(row.assetName);
    if (nameKey) {
      if (!rowsByAssetName.has(nameKey)) rowsByAssetName.set(nameKey, []);
      rowsByAssetName.get(nameKey).push(row);
    }
  });
  const seen = new Set();
  return (assetOptions || []).map((asset) => {
    const key = assetOptionKey(asset);
    if (!key || seen.has(key)) return null;
    seen.add(key);
    const staticPayload = ASSET_PAYLOADS[asset.assetId] || findAssetPayload(asset.assetId, asset.assetName) || {};
    const candidates = [
      ...(rowsByAssetId.get(asset.assetId) || []),
      ...(rowsByAssetName.get(normalizeAssetNameKey(asset.assetName)) || []),
      ...(staticPayload.rows || staticPayload.leaseSpaces || []),
      staticPayload.overview,
      asset,
    ].filter(Boolean);
    const payload = candidates.map((candidate) => buildBuildingRegisterPayload(candidate)).find(isCompleteBuildingRegisterPayload)
      || buildBuildingRegisterPayload(asset);
    return {
      assetId: asset.assetId,
      assetName: asset.assetName || staticPayload.overview?.assetName || '-',
      payload,
      ready: isCompleteBuildingRegisterPayload(payload),
    };
  }).filter(Boolean);
}

function companyStaticPayloadFor(candidate = {}) {
  const tenantId = String(candidate.tenantId || candidate.tenant_id || '').trim();
  if (tenantId && COMPANY_PAYLOADS[tenantId]) return COMPANY_PAYLOADS[tenantId];
  const nameKey = normalizeAssetNameKey(candidate.tenantMasterName || candidate.companyName || candidate.tenantName);
  if (!nameKey) return {};
  return Object.values(COMPANY_PAYLOADS).find((payload) => (
    normalizeAssetNameKey(payload.profile?.tenantMasterName || payload.profile?.company?.tenantMasterName) === nameKey
  )) || {};
}

function buildOpenDartRefreshTargets(companyOptions = [], generalRows = []) {
  const targets = new Map();
  const addCandidate = (candidate = {}) => {
    const staticPayload = companyStaticPayloadFor(candidate);
    const profile = staticPayload.profile || {};
    const company = profile.company || {};
    const tenantId = String(firstDefined(candidate.tenantId, candidate.tenant_id, profile.tenantId, staticPayload.filters?.selectedTenantId, '') || '').trim();
    const tenantName = cleanDisplay(firstDefined(candidate.tenantMasterName, candidate.companyName, candidate.tenantName, profile.tenantMasterName, company.tenantMasterName), '');
    const corpCode = String(firstDefined(candidate.dartCorpCode, candidate.dart_corp_code, profile.dartCorpCode, company.dartCorpCode, '') || '').trim();
    const key = corpCode || tenantId || normalizeAssetNameKey(tenantName);
    if (!key || targets.has(key)) return;
    targets.set(key, {
      tenantId,
      tenantName: tenantName || '-',
      corpCode,
      ready: Boolean(corpCode),
    });
  };
  (companyOptions || []).forEach(addCandidate);
  (generalRows || []).forEach(addCandidate);
  return [...targets.values()].sort((a, b) => String(a.tenantName || '').localeCompare(String(b.tenantName || ''), 'ko-KR'));
}

function externalRefreshOutcome(data, error) {
  if (error) return { status: '실패', stored: false, refreshed: false, message: error.message || '요청 실패' };
  if (!data || data.ok === false) return { status: '실패', stored: false, refreshed: false, message: data?.message || 'API 응답 실패' };
  const cache = data.cache || {};
  if (cache.stale) return { status: '기존 저장값 유지', stored: false, refreshed: false, message: '실시간 호출 실패로 저장된 값을 표시했습니다.' };
  if (cache.hit === false) return { status: '새로고침 완료', stored: !cache.write_error, refreshed: true, message: cache.write_error || 'Supabase 저장 완료' };
  return { status: '저장값 확인', stored: true, refreshed: false, message: 'Supabase 저장값을 확인했습니다.' };
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

function monthlyCostCompositionLimit(mode) {
  return mode === 'asset' ? 32 : 8;
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

function formatFavorMonths(value) {
  if (value === undefined || value === null || value === '') return '-';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return cleanDisplay(value, '-');
  return `${formatDecimalNumber(numeric, numeric % 1 === 0 ? 0 : 1)}개월`;
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

function formatCompactDate(value) {
  const text = String(value || '').replace(/\D/gu, '');
  if (text.length === 8) return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
  return formatDate(value);
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

function useLatestWeeklyAssetRows(permission, memberInfo) {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('idle');
  useEffect(() => {
    let cancelled = false;
    const fetchRows = async () => {
      setStatus('loading');
      let nextRows = [];
      try {
        const { data, error } = await supabase.functions.invoke('ll-dashboard-api', {
          body: { action: 'weekly-assets/latest', payload: {} },
        });
        if (error || data?.ok === false) throw error || new Error(data?.message || 'weekly asset read failed');
        nextRows = normalizeWeeklyAssetRows(data?.data?.rows || []);
      } catch {
        nextRows = [];
      }
      if (!nextRows.length) {
        try {
          const { data, error } = await supabase.functions.invoke('ll-dashboard-api', {
            body: {
              action: 'weekly-assets/latest-preview',
              payload: { email: permission?.email || memberInfo?.email || '' },
            },
          });
          if (error || data?.ok === false) throw error || new Error(data?.message || 'weekly asset preview read failed');
          nextRows = normalizeWeeklyAssetRows(data?.data?.rows || []);
        } catch {
          nextRows = [];
        }
      }
      if (!cancelled) {
        setRows(nextRows);
        setStatus(nextRows.length ? 'live' : 'empty');
      }
    };
    fetchRows();
    return () => {
      cancelled = true;
    };
  }, [memberInfo?.email, permission?.email, permission?.role]);
  return { rows, status };
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
        {eyebrow ? <div className="text-[11px] font-semibold text-[#86868B] tracking-[0.02em]">{eyebrow}</div> : null}
        <h2 className={`font-semibold text-white tracking-tight ${eyebrow ? 'mt-1 text-[20px]' : 'text-[28px]'}`}>{title}</h2>
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
  const compact = /^(No\.?|ID|코드|구분|상태|여부|단계|우선순위|중요도|RF|FO|TI)$/u.test(label);
  const countLike = /^(자산 수|구역 수|행 수|건수)$/u.test(label);
  const periodLike = /계약기간|현재 계약기간/u.test(label);
  const dateLike = !periodLike && /날짜|일자|시점|만기|마감|기간|보고일|개시일|종료일/u.test(label);
  const numeric = /수$|건$|개$|율|비율|면적|평|금액|임대료|관리비|임관리비|NOC|원가|차이|합계|잔여|개월|비중/u.test(label);
  const nameLike = /자산명|임차인명|기업명|회사|프로젝트|Task|업무명|펀드명/u.test(label);
  const spaceLike = /층|구역|공간|호실|자산 목록/u.test(label);
  const longText = /내용|이슈|계획|액션|비고|주소|목록|원문|상세|source|Main Issue/u.test(label);
  let width = '140px';
  if (total <= 2) width = index === 0 ? '28%' : '72%';
  else if (label === '임차인명') width = '178px';
  else if (label === '자산 목록') width = '260px';
  else if (periodLike) width = '220px';
  else if (countLike) width = '72px';
  else if (compact) width = '76px';
  else if (dateLike) width = '112px';
  else if (numeric) width = '98px';
  else if (nameLike) width = index === 0 ? '240px' : '190px';
  else if (spaceLike) width = '118px';
  else if (longText) width = '240px';
  return { label, compact, countLike, dateLike, numeric, nameLike, spaceLike, longText, periodLike, width };
}

function normalizeTableColumnWidths(metas) {
  if (metas.length >= 8) return metas;
  const weights = metas.map((meta, index) => {
    if (metas.length <= 2) return index === 0 ? 0.2 : 0.8;
    if (meta.label === '자산 목록') return 1.35;
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
  if (meta.periodLike) {
    return <span className="block whitespace-normal break-keep leading-5" title={text}>{text}</span>;
  }
  if (meta.numeric || meta.compact || meta.dateLike || meta.nameLike || meta.spaceLike) {
    return <span className="block truncate" title={text}>{text}</span>;
  }
  if (meta.longText || text.length > 34) {
    return <span className="block whitespace-normal break-keep leading-5" title={text}>{text}</span>;
  }
  return <span className="block truncate" title={text}>{text}</span>;
}

function DataTable({ headers, rows, onRowClick, compact = false, columnWidths = null, minTableWidth: minTableWidthProp, tight = false }) {
  const defaultMetas = normalizeTableColumnWidths(headers.map((header, index) => getTableColumnMeta(header, index, headers.length)));
  const metas = Array.isArray(columnWidths) && columnWidths.length
    ? defaultMetas.map((meta, index) => ({ ...meta, width: columnWidths[index] || meta.width }))
    : defaultMetas;
  const computedMinTableWidth = headers.length >= 8
    ? `${Math.max(980, headers.length * 122)}px`
    : undefined;
  const minTableWidth = minTableWidthProp === null ? undefined : (minTableWidthProp || computedMinTableWidth);
  const headerPaddingClass = tight ? 'px-2 first:pl-3 last:pr-3' : 'px-3 first:pl-4 last:pr-4';
  const bodyPaddingClass = tight ? 'px-2 first:pl-3 last:pr-3' : 'px-3 first:pl-4 last:pr-4';
  const bodyTextClass = tight ? 'text-[12px]' : 'text-[13px]';
  return (
    <div className="custom-scrollbar overflow-x-auto rounded-[10px] border border-[#333333]">
      <table className="w-full min-w-full table-fixed border-collapse text-left" style={minTableWidth ? { minWidth: minTableWidth } : undefined}>
        <colgroup>
          {metas.map((meta, index) => <col key={`${tableHeaderText(headers[index])}-${index}`} style={{ width: meta.width }} />)}
        </colgroup>
        <thead className="bg-[#1F1F1E] text-[#86868B] text-[12px]">
          <tr>
            {headers.map((header, index) => (
              <th key={`${tableHeaderText(header)}-${index}`} className={`${headerPaddingClass} py-2 font-semibold ${metas[index].numeric ? 'text-right' : 'text-left'} ${metas[index].compact || metas[index].dateLike ? 'whitespace-nowrap' : 'break-keep'}`}>{header}</th>
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
                <td key={cellIndex} className={`${compact ? 'py-1.5' : 'py-2.5'} ${bodyPaddingClass} align-top ${bodyTextClass} leading-5 text-[#E5E5E5] ${metas[cellIndex]?.numeric ? 'text-right tabular-nums' : 'text-left'} ${metas[cellIndex]?.compact || metas[cellIndex]?.dateLike || metas[cellIndex]?.nameLike || metas[cellIndex]?.spaceLike ? 'whitespace-nowrap' : ''}`}>
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

function normalizeSortableValue(value) {
  if (value == null || value === '' || value === '-') return { type: 'empty', value: '' };
  const text = String(value).trim();
  const numberCandidate = text.replace(/[,%원억평㎡\s]/g, '');
  if (numberCandidate !== '' && !Number.isNaN(Number(numberCandidate))) {
    return { type: 'number', value: Number(numberCandidate) };
  }
  const dateCandidate = Date.parse(text.replace(/\./g, '-'));
  if (!Number.isNaN(dateCandidate) && /\d{4}/.test(text)) {
    return { type: 'number', value: dateCandidate };
  }
  return { type: 'text', value: text.toLocaleLowerCase('ko-KR') };
}

function compareSortableCells(left, right, direction) {
  const leftValue = normalizeSortableValue(left);
  const rightValue = normalizeSortableValue(right);
  if (leftValue.type === 'empty' && rightValue.type !== 'empty') return 1;
  if (leftValue.type !== 'empty' && rightValue.type === 'empty') return -1;
  if (leftValue.type === 'number' && rightValue.type === 'number') {
    return direction === 'asc' ? leftValue.value - rightValue.value : rightValue.value - leftValue.value;
  }
  const result = String(leftValue.value).localeCompare(String(rightValue.value), 'ko-KR', { numeric: true, sensitivity: 'base' });
  return direction === 'asc' ? result : -result;
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
      ? 'max-w-none'
      : 'max-w-[1120px]';
  const bodyHeightClass = modal.size === 'fullscreen' ? 'h-[calc(100vh-102px)]' : 'max-h-[calc(88vh-88px)]';
  return (
    <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center px-4 py-4" role="dialog" aria-modal="true">
      <div className={`w-full ${sizeClass} ${modal.size === 'fullscreen' ? 'h-[calc(100vh-32px)] max-h-[calc(100vh-32px)]' : 'max-h-[94vh]'} overflow-hidden rounded-[18px] border border-[#3A3A3C] bg-[#252524] shadow-2xl`}>
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

const MANAGEMENT_PROJECT_ASSET_ALIASES = {
  이천마장면물류센터: ['이천회억리물류센터'],
  동산물류센터: ['이천회억리물류센터'],
  부산송정물류센터: ['부산송정물류센터'],
  경산쿠팡물류센터: ['경산쿠팡물류센터'],
  인천석남물류센터: ['인천석남물류센터'],
  화성석포리물류센터: ['화성석포리물류센터'],
};

function findManagementProjectForAsset(assetName) {
  const assetKey = normalizeAssetNameKey(assetName);
  if (!assetKey) return null;
  const acceptedKeys = new Set([assetKey, ...(MANAGEMENT_PROJECT_ASSET_ALIASES[assetKey] || [])]);
  return (weeklyReportData.managementProjects || []).find((project) => {
    const projectKey = normalizeAssetNameKey(project.projectName);
    return [...acceptedKeys].some((key) => projectKey.includes(key) || key.includes(projectKey));
  }) || null;
}

function splitManagementProjectRows(project) {
  const rows = project?.detailRows || [];
  const overviewLabels = new Set(['주소', '섹터', '연면적', '대지면적', '용적률 및 건폐율', '규모(층수)']);
  const investmentLabels = new Set(['투자 전략', '총 사업비', 'Equity', 'Loan', '기타']);
  return {
    overviewRows: rows
      .filter((row) => overviewLabels.has(row.label))
      .map((row) => [row.label, renderBulletListCell(row.value)]),
    investmentRows: rows
      .filter((row) => investmentLabels.has(row.label))
      .map((row) => [row.label, renderBulletListCell(row.value)]),
  };
}

function managementProjectValue(project, label) {
  return cleanDisplay((project?.detailRows || []).find((row) => row.label === label)?.value, '');
}

function normalizeAssetCategory(value) {
  const text = cleanDisplay(value, '');
  if (!text) return '';
  if (text.includes('복합')) return '복합';
  if (text.includes('저온')) return '저온';
  if (text.includes('상온')) return '상온';
  return text;
}

function normalizeFloorScale(value) {
  return cleanDisplay(value, '').replace(/\s*\/\s*/gu, '~').replace(/\bB(\d+)~(\d+)F\b/giu, 'B$1~$2F');
}

function splitProjectEtcRows(value) {
  return cleanDisplay(value, '')
    .split(/\s*\/\s*/u)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const match = item.match(/^([가-힣A-Za-z]+)\s+(.+)$/u);
      return ['기타', match?.[1] || item, match?.[2] || ''];
    });
}

function findAssetPayloadByName(assetName) {
  const key = normalizeAssetNameKey(assetName);
  return Object.values(ASSET_PAYLOADS).find((payload) => normalizeAssetNameKey(payload?.overview?.assetName) === key) || null;
}

function buildAssetOverviewRows(assetName, project, weeklyRow) {
  const payload = findAssetPayloadByName(assetName);
  const overview = payload?.overview || {};
  return [
    ['자산', '구분', normalizeAssetCategory(managementProjectValue(project, '섹터') || weeklyRow?.category)],
    ['자산', '주소', managementProjectValue(project, '주소') || cleanDisplay(overview.address || overview.standardizedAddress, '')],
    ['면적', '연면적', managementProjectValue(project, '연면적') || (overview.grossFloorAreaSqm ? formatArea(overview.grossFloorAreaSqm) : '')],
    ['면적', '대지면적', managementProjectValue(project, '대지면적') || (overview.landAreaSqm ? formatArea(overview.landAreaSqm) : '')],
    ['개발', '용적률', cleanDisplay(managementProjectValue(project, '용적률') || String(managementProjectValue(project, '용적률 및 건폐율')).split(/[·,/]/u)[0], '')],
    ['개발', '건폐율', cleanDisplay(managementProjectValue(project, '건폐율') || String(managementProjectValue(project, '용적률 및 건폐율')).split(/[·,/]/u)[1], '')],
    ['개발', '준공시점', cleanDisplay(weeklyRow?.completion || overview.completionDate || overview.completion, '')],
    ['개발', '규모(층수)', normalizeFloorScale(managementProjectValue(project, '규모(층수)') || overview.floorScale)],
    ['임대차', '주요 임차인', cleanDisplay(weeklyRow?.mainTenant || overview.mainTenant || overview.anchorTenant, '')],
  ];
}

const BUILDING_REGISTER_OVERVIEW_TEMPLATE = [
  ['대지위치', 'plat_plc'],
  ['도로명주소', 'new_plat_plc'],
  ['건물명', 'bld_nm'],
  ['주용도', 'main_purps_cd_nm'],
  ['기타용도', 'etc_purps'],
  ['구조', 'strct_cd_nm'],
  ['지붕', 'roof_cd_nm'],
  ['대지면적', 'plat_area', 'sqm'],
  ['건축면적', 'arch_area', 'sqm'],
  ['연면적', 'tot_area', 'sqm'],
  ['용적률 산정 연면적', 'vl_rat_estm_tot_area', 'sqm'],
  ['건폐율', 'bc_rat', 'percentNumber'],
  ['용적률', 'vl_rat', 'percentNumber'],
  ['지상층수', 'grnd_flr_cnt'],
  ['지하층수', 'ugrnd_flr_cnt'],
  ['높이', 'heit', 'meter'],
  ['세대수', 'hhld_cnt'],
  ['가구수', 'fmly_cnt'],
  ['호수', 'ho_cnt'],
  ['주건축물 수', 'main_bld_cnt'],
  ['부속건축물 수', 'atch_bld_cnt'],
  ['총 주차대수', 'tot_pkng_cnt'],
  ['사용승인일', 'use_apr_day', 'date'],
  ['관리건축물대장PK', 'mgm_bldrgst_pk'],
];

function formatBuildingRegisterValue(value, type) {
  if (value === undefined || value === null || value === '') return '-';
  if (type === 'date') return formatCompactDate(value);
  if (type === 'sqm') {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return cleanDisplay(value, '-');
    return `${formatNumber(numeric)}㎡ (${formatDecimalNumber(numeric * 0.3025, 1)}평)`;
  }
  if (type === 'percentNumber') {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return cleanDisplay(value, '-');
    return `${formatDecimalNumber(numeric, 2)}%`;
  }
  if (type === 'meter') {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return cleanDisplay(value, '-');
    return `${formatDecimalNumber(numeric, 2)}m`;
  }
  return cleanDisplay(value, '-');
}

function snakeToCamelKey(key = '') {
  return String(key).replace(/_([a-z])/gu, (_, letter) => letter.toUpperCase());
}

function buildBuildingRegisterOverviewRows(summary = {}) {
  const source = summary && typeof summary === 'object' ? summary : {};
  return BUILDING_REGISTER_OVERVIEW_TEMPLATE.map(([label, key, type]) => [
    '건축물대장',
    label,
    formatBuildingRegisterValue(firstDefined(source[key], source[snakeToCamelKey(key)]), type),
  ]);
}

function mergeBuildingRegisterOverviewRows(baseRows = [], summary = null) {
  const withoutBuildingRows = (baseRows || []).filter((row) => row?.[0] !== '건축물대장');
  return [...withoutBuildingRows, ...buildBuildingRegisterOverviewRows(summary || {})];
}

function buildAssetInvestmentRows(project, weeklyRow) {
  const baseRows = [
    ['투자', '투자 전략', managementProjectValue(project, '투자 전략') || cleanDisplay(weeklyRow?.investmentType, '')],
    ['투자', '매입시점', cleanDisplay(weeklyRow?.acquisition, '')],
    ['자금', '총 사업비', managementProjectValue(project, '총 사업비')],
    ['자금', 'Equity', managementProjectValue(project, 'Equity')],
    ['자금', 'Loan', managementProjectValue(project, 'Loan')],
    ['만기', '펀드만기', cleanDisplay(weeklyRow?.fundMaturity, '')],
    ['만기', '대출만기', cleanDisplay(weeklyRow?.loanMaturity, '')],
  ];
  const parsedEtcRows = splitProjectEtcRows(managementProjectValue(project, '기타'));
  const parsedByItem = new Map(parsedEtcRows.map((row) => [row[1], row[2]]));
  const fixedEtcRows = [
    '매입가',
    '평당 매입가',
    '취득가',
    '장부가',
    '임대면적',
    '임대구조',
    '저온비중',
    '주차장',
    'WARE',
    '시공사',
    '구조',
    '전기용량',
    '하중',
    '층고',
    '주요투자자',
    '담보대출',
    'NPL',
    '주요대주',
    '리파캐피탈',
    '대출만기',
    '목표 IRR',
    '목표 배당',
    '보통주 재간접 설정액',
    '우선주 재간접 설정액',
    '셀다운',
    '운영사',
    '비고',
  ].map((item) => ['기타', item, parsedByItem.get(item) || '']);
  const extraEtcRows = parsedEtcRows.filter((row) => !fixedEtcRows.some((fixed) => fixed[1] === row[1]));
  return [...baseRows, ...fixedEtcRows, ...extraEtcRows];
}

function normalizeInvestmentRowsForUi(rows = []) {
  return (Array.isArray(rows) ? rows : []).flatMap((row) => {
    const cells = Array.isArray(row) ? row : [];
    const group = cleanDisplay(cells[0], '');
    const item = cleanDisplay(cells[1], '');
    const value = cleanDisplay(cells[2], '');
    if (group && item && group === item && value.includes('/')) {
      const splitRows = splitProjectEtcRows(value);
      return splitRows.length ? splitRows.map((splitRow) => [group, splitRow[1] || item, splitRow[2] || '']) : [cells];
    }
    return [cells];
  });
}

const FUND_INFO_ROW_TEMPLATE = [
  ['펀드 정보', '펀드명', ''],
  ['펀드 정보', '약칭', ''],
  ['펀드 정보', '법적형태', ''],
  ['펀드 정보', '투자섹터', ''],
  ['펀드 정보', '펀드유형', ''],
  ['펀드 정보', '투자전략', ''],
  ['펀드 정보', '최초설정일', ''],
  ['펀드 정보', '만기일', ''],
];

function buildDefaultFundInfoRows(assetName, weeklyRow) {
  const option = assetOptionsData.find((asset) => normalizeAssetNameKey(asset.assetName) === normalizeAssetNameKey(assetName));
  const context = WEEKLY_ASSET_DB_CONTEXT[normalizeAssetNameKey(assetName)] || WEEKLY_ASSET_DB_CONTEXT[normalizeAssetNameKey(weeklyRow?.assetName)];
  const fundName = cleanDisplay(option?.fundName || weeklyRow?.fundName || context?.fundName, '');
  return FUND_INFO_ROW_TEMPLATE.map((row) => [row[0], row[1], row[1] === '펀드명' ? fundName : '']);
}

function normalizeFundInfoRowsForUi(rows, fallbackRows) {
  const rawRows = Array.isArray(rows) ? rows : [];
  const byItem = new Map(rawRows.map((row) => [cleanDisplay(row?.[1], ''), cleanDisplay(row?.[2], '')]));
  return FUND_INFO_ROW_TEMPLATE.map((row) => {
    const fallback = fallbackRows.find((item) => item[1] === row[1]);
    return [row[0], row[1], byItem.has(row[1]) ? byItem.get(row[1]) : fallback?.[2] || ''];
  });
}

function normalizeFundBeneficiaryRowsForUi(rows) {
  return (Array.isArray(rows) ? rows : []).map((row, index) => ({
    row_key: row.row_key || `beneficiary_${index + 1}`,
    tranche: cleanDisplay(row.tranche, ''),
    beneficiary_name: cleanDisplay(row.beneficiary_name || row.beneficiaryName, ''),
    committed_amount_krw: cleanDisplay(row.committed_amount_krw ?? row.committedAmountKrw, ''),
  }));
}

function normalizeFundLoanRowsForUi(rows) {
  return (Array.isArray(rows) ? rows : []).map((row, index) => ({
    row_key: row.row_key || `loan_${index + 1}`,
    tranche: cleanDisplay(row.tranche, ''),
    lender_name: cleanDisplay(row.lender_name || row.lenderName, ''),
    committed_amount_krw: cleanDisplay(row.committed_amount_krw ?? row.committedAmountKrw, ''),
    drawdown_date: cleanDisplay(row.drawdown_date || row.drawdownDate, ''),
    maturity_date: cleanDisplay(row.maturity_date || row.maturityDate, ''),
    loan_period: cleanDisplay(row.loan_period || row.loanPeriod, ''),
    loan_type: cleanDisplay(row.loan_type || row.loanType, ''),
    interest_type: cleanDisplay(row.interest_type || row.interestType, ''),
    base_rate: cleanDisplay(row.base_rate || row.baseRate, ''),
    spread_rate: cleanDisplay(row.spread_rate || row.spreadRate, ''),
    loan_rate: cleanDisplay(row.loan_rate || row.loanRate, ''),
    interest_rate: cleanDisplay(row.interest_rate || row.interestRate || row.loan_rate || row.loanRate, ''),
    fee: cleanDisplay(row.fee || row.fee_rate || row.feeRate, ''),
    fee_rate: cleanDisplay(row.fee_rate || row.feeRate || row.fee, ''),
    all_in: cleanDisplay(row.all_in || row.allIn || row.all_in_rate || row.allInRate, ''),
    all_in_rate: cleanDisplay(row.all_in_rate || row.allInRate || row.all_in || row.allIn, ''),
  }));
}

function AssetProjectToggleTable({ id, title, rows, openSections, onToggle, isEditing = false, onCellChange, onAddRow, onDeleteRow }) {
  const groupedRows = rows.map((row, index) => {
    const [group] = row;
    const shouldMergeGroup = true;
    const isFirst = !shouldMergeGroup || index === 0 || rows[index - 1]?.[0] !== group;
    let rowSpan = 0;
    if (isFirst) {
      if (!shouldMergeGroup) {
        rowSpan = 1;
      } else {
        for (let cursor = index; cursor < rows.length && rows[cursor]?.[0] === group; cursor += 1) {
          rowSpan += 1;
        }
      }
    }
    return { row, isFirst, rowSpan, originalIndex: index };
  });

  return (
    <div className="rounded-[14px] border border-[#333333] bg-[#1F1F1E] p-4">
      <button
        type="button"
        onClick={() => onToggle(id)}
        className="mb-3 flex w-full items-center justify-between text-left"
      >
        <span className="text-[15px] font-bold text-white">{title}</span>
        <span className="rounded-[6px] border border-[#3A3A3C] bg-[#252524] px-2 py-1 text-[12px] font-semibold text-[#D1D1D6]">{openSections[id] ? '접기' : '펼치기'}</span>
      </button>
      {openSections[id] ? (
        <div className="overflow-hidden rounded-[10px] border border-[#333333]">
          <table className="w-full table-fixed border-collapse text-left">
            <colgroup>
              <col className="w-[86px]" />
              <col className="w-[128px]" />
              <col />
              {isEditing ? <col className="w-[70px]" /> : null}
            </colgroup>
            <thead className="bg-[#252524] text-[12px] font-semibold text-[#86868B]">
              <tr>
                <th className="border-b border-[#333333] px-3 py-2">구분</th>
                <th className="border-b border-[#333333] px-3 py-2">항목</th>
                <th className="border-b border-[#333333] px-3 py-2">내용</th>
                {isEditing ? <th className="border-b border-[#333333] px-3 py-2 text-center">관리</th> : null}
              </tr>
            </thead>
            <tbody>
              {groupedRows.map(({ row, isFirst, rowSpan, originalIndex }, index) => (
                <tr key={`${row[0]}-${row[1]}-${index}`} className="border-b border-[#333333] last:border-b-0">
                  {isFirst ? (
                    <td rowSpan={rowSpan} className="border-r border-[#333333] bg-[#252524] px-2 py-2 align-middle text-center text-[12px] font-bold text-white">
                      {isEditing ? (
                        <input
                          value={row[0]}
                          onChange={(event) => onCellChange?.(id, originalIndex, 0, event.target.value)}
                          className="h-9 w-full rounded-[7px] border border-[#3A3A3C] bg-[#111] px-2 text-center text-[12px] font-bold text-white outline-none focus:border-[#8E8E93]"
                        />
                      ) : row[0]}
                    </td>
                  ) : null}
                  <td className="border-r border-[#333333] px-2 py-2 align-top text-[12px] font-semibold text-[#D1D1D6]">
                    {isEditing ? (
                      <input
                        value={row[1]}
                        onChange={(event) => onCellChange?.(id, originalIndex, 1, event.target.value)}
                        className="h-9 w-full rounded-[7px] border border-[#3A3A3C] bg-[#111] px-2 text-[12px] font-semibold text-white outline-none focus:border-[#8E8E93]"
                      />
                    ) : row[1]}
                  </td>
                  <td className="px-3 py-2 align-top text-[12px] leading-5 text-[#E5E5E5]">
                    {isEditing ? (
                      <textarea
                        value={row[2] || ''}
                        onChange={(event) => onCellChange?.(id, originalIndex, 2, event.target.value)}
                        rows={2}
                        className="min-h-[42px] w-full resize-y rounded-[7px] border border-[#3A3A3C] bg-[#111] px-2 py-2 text-[12px] leading-5 text-white outline-none focus:border-[#8E8E93]"
                      />
                    ) : (row[2] || <span className="text-[#555]">-</span>)}
                  </td>
                  {isEditing ? (
                    <td className="px-2 py-2 text-center align-top">
                      <button type="button" onClick={() => onDeleteRow?.(id, originalIndex)} className="h-8 rounded-[7px] border border-[#ef4444]/30 bg-[#ef4444]/10 px-2 text-[12px] font-bold text-[#ef4444] hover:bg-[#ef4444]/20">삭제</button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
          {isEditing ? (
            <div className="border-t border-[#333333] bg-[#252524] p-2">
              <button type="button" onClick={() => onAddRow?.(id)} className={`h-8 rounded-[7px] border px-3 text-[12px] font-bold ${DARK_BUTTON_CLASS}`}>행 추가</button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function FundTrancheTable({ title, columns, rows, isEditing, onChange, onAdd, onDelete }) {
  return (
    <div className="overflow-hidden rounded-[10px] border border-[#333333]">
      <div className="flex items-center justify-between border-b border-[#333333] bg-[#252524] px-3 py-2">
        <div className="text-[12px] font-bold text-white">{title}</div>
        {isEditing ? <button type="button" onClick={onAdd} className={`h-7 rounded-[7px] border px-2 text-[11px] font-bold ${DARK_BUTTON_CLASS}`}>행 추가</button> : null}
      </div>
      <div className="custom-scrollbar overflow-x-auto">
        <table className="w-full min-w-max table-auto border-collapse text-left">
          <colgroup>
            {columns.map((column) => <col key={column.key} style={{ width: column.width || 128, minWidth: column.width || 128 }} />)}
            {isEditing ? <col style={{ width: 70 }} /> : null}
          </colgroup>
          <thead className="bg-[#1F1F1E] text-[12px] font-semibold text-[#86868B]">
            <tr>
              {columns.map((column) => <th key={column.key} className="border-b border-[#333333] px-2 py-2">{column.label}</th>)}
              {isEditing ? <th className="border-b border-[#333333] px-2 py-2 text-center">관리</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.length ? rows.map((row, rowIndex) => (
              <tr key={row.row_key || rowIndex} className="border-b border-[#333333] last:border-b-0">
                {columns.map((column) => (
                  <td key={column.key} className="px-2 py-2 align-top text-[12px] leading-5 text-[#E5E5E5]">
                    {isEditing ? (
                      <input
                        value={row[column.key] || ''}
                        title={String(row[column.key] || '')}
                        onChange={(event) => onChange(rowIndex, column.key, event.target.value)}
                        className="h-9 w-full rounded-[7px] border border-[#3A3A3C] bg-[#111] px-2 text-[12px] text-white outline-none focus:border-[#8E8E93]"
                      />
                    ) : column.format ? column.format(row[column.key]) : (row[column.key] || <span className="text-[#555]">-</span>)}
                  </td>
                ))}
                {isEditing ? (
                  <td className="px-2 py-2 text-center align-top">
                    <button type="button" onClick={() => onDelete(rowIndex)} className="h-8 rounded-[7px] border border-[#ef4444]/30 bg-[#ef4444]/10 px-2 text-[12px] font-bold text-[#ef4444] hover:bg-[#ef4444]/20">삭제</button>
                  </td>
                ) : null}
              </tr>
            )) : (
              <tr>
                <td colSpan={columns.length + (isEditing ? 1 : 0)} className="px-3 py-6 text-center text-[12px] text-[#86868B]">등록된 내용이 없습니다.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FundInfoTable({ rows, isEditing, onCellChange }) {
  const groupedRows = rows.map((row, index) => {
    const [group] = row;
    const isFirst = index === 0 || rows[index - 1]?.[0] !== group;
    let rowSpan = 0;
    if (isFirst) {
      for (let cursor = index; cursor < rows.length && rows[cursor]?.[0] === group; cursor += 1) rowSpan += 1;
    }
    return { row, isFirst, rowSpan, originalIndex: index };
  });

  return (
    <div className="overflow-hidden rounded-[10px] border border-[#333333]">
      <table className="w-full table-fixed border-collapse text-left">
        <colgroup>
          <col className="w-[92px]" />
          <col className="w-[122px]" />
          <col />
        </colgroup>
        <thead className="bg-[#252524] text-[12px] font-semibold text-[#86868B]">
          <tr>
            <th className="border-b border-[#333333] px-3 py-2">구분</th>
            <th className="border-b border-[#333333] px-3 py-2">항목</th>
            <th className="border-b border-[#333333] px-3 py-2">내용</th>
          </tr>
        </thead>
        <tbody>
          {groupedRows.map(({ row, isFirst, rowSpan, originalIndex }, index) => (
            <tr key={`${row[0]}-${row[1]}-${index}`} className="border-b border-[#333333] last:border-b-0">
              {isFirst ? (
                <td rowSpan={rowSpan} className="border-r border-[#333333] bg-[#252524] px-2 py-2 align-middle text-center text-[12px] font-bold text-white">{row[0]}</td>
              ) : null}
              <td className="border-r border-[#333333] px-2 py-2 align-top text-[12px] font-semibold text-[#D1D1D6]">{row[1]}</td>
              <td className="px-3 py-2 align-top text-[12px] leading-5 text-[#E5E5E5]">
                {isEditing ? (
                  <input
                    value={row[2] || ''}
                    onChange={(event) => onCellChange?.('fundInfo', originalIndex, 2, event.target.value)}
                    className="h-9 w-full rounded-[7px] border border-[#3A3A3C] bg-[#111] px-2 text-[12px] text-white outline-none focus:border-[#8E8E93]"
                  />
                ) : (row[2] || <span className="text-[#555]">-</span>)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AssetFundOverviewTable({
  open,
  onToggle,
  fundInfoRows,
  beneficiaryRows,
  loanRows,
  blockedMessage,
  isEditing = false,
  onFundInfoCellChange,
  onBeneficiaryChange,
  onBeneficiaryAdd,
  onBeneficiaryDelete,
  onLoanChange,
  onLoanAdd,
  onLoanDelete,
}) {
  const beneficiaryColumns = [
    { key: 'tranche', label: 'tranche', width: 120 },
    { key: 'beneficiary_name', label: '수익자', width: 180 },
    { key: 'committed_amount_krw', label: '투입금액(원)', width: 150, format: (value) => (value ? formatWon(value) : '-') },
  ];
  const loanColumns = [
    { key: 'loan_type', label: '대출유형', width: 120 },
    { key: 'tranche', label: 'tranche', width: 120 },
    { key: 'lender_name', label: '대주', width: 220 },
    { key: 'committed_amount_krw', label: '인출금액(원)', width: 170, format: (value) => (value ? formatWon(value) : '-') },
    { key: 'drawdown_date', label: '인출시점', width: 130 },
    { key: 'maturity_date', label: '만기시점', width: 130 },
    { key: 'interest_type', label: '이자유형', width: 120 },
    { key: 'base_rate', label: '기준금리(%)', width: 120 },
    { key: 'spread_rate', label: '가산금리(%)', width: 120 },
    { key: 'loan_rate', label: '대출금리(%)', width: 120 },
    { key: 'fee_rate', label: '수수료율(%)', width: 120 },
    { key: 'all_in_rate', label: 'All-In(%)', width: 120 },
  ];

  return (
    <div className="rounded-[14px] border border-[#333333] bg-[#1F1F1E] p-4">
      <button
        type="button"
        onClick={onToggle}
        className="mb-3 flex w-full items-center justify-between text-left"
      >
        <span className="text-[15px] font-bold text-white">펀드개요</span>
        <span className="rounded-[6px] border border-[#3A3A3C] bg-[#252524] px-2 py-1 text-[12px] font-semibold text-[#D1D1D6]">{open ? '접기' : '펼치기'}</span>
      </button>
      {open ? (
        <div className="space-y-3">
          {blockedMessage ? (
            <div className="rounded-[10px] border border-[#3A3A3C] bg-[#252524] px-3 py-2 text-[13px] font-semibold text-[#D1D1D6]">
              {blockedMessage}
            </div>
          ) : null}
          <FundInfoTable rows={fundInfoRows} isEditing={isEditing} onCellChange={onFundInfoCellChange} />
          <FundTrancheTable
            title="수익자 정보"
            columns={beneficiaryColumns}
            rows={beneficiaryRows}
            isEditing={isEditing}
            onChange={onBeneficiaryChange}
            onAdd={onBeneficiaryAdd}
            onDelete={onBeneficiaryDelete}
          />
          <FundTrancheTable
            title="대주 정보"
            columns={loanColumns}
            rows={loanRows}
            isEditing={isEditing}
            onChange={onLoanChange}
            onAdd={onLoanAdd}
            onDelete={onLoanDelete}
          />
        </div>
      ) : null}
    </div>
  );
}

function AssetProjectInfoPanel({ assetName, modalMode = false, buildingRegisterSummary = null }) {
  const { memberInfo } = useAuth();
  const permission = useMemo(() => resolveLogisticsPermission(memberInfo), [memberInfo]);
  const { rows: latestWeeklyAssetRows } = useLatestWeeklyAssetRows(permission, memberInfo);
  const [openSections, setOpenSections] = useState({ overview: false, investment: false, fund: false });
  const [isEditing, setIsEditing] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [serverRows, setServerRows] = useState(null);
  const [serverFundRows, setServerFundRows] = useState(null);
  const [fundAccessBlock, setFundAccessBlock] = useState(null);
  const [fundReadMode, setFundReadMode] = useState('idle');
  const [draftRows, setDraftRows] = useState({ overview: [], investment: [], fundInfo: [], fundBeneficiaries: [], fundLoans: [] });
  const toggleSection = (id) => setOpenSections((current) => ({ ...current, [id]: !current[id] }));
  const project = useMemo(() => findManagementProjectForAsset(assetName), [assetName]);
  const weeklyAssetRowsForSource = useMemo(() => (
    latestWeeklyAssetRows.length ? latestWeeklyAssetRows : normalizeWeeklyAssetRows(weeklyReportData.assetRows || [])
  ), [latestWeeklyAssetRows]);
  const weeklyRow = useMemo(() => (
    weeklyAssetRowsForSource
      .find((row) => normalizeAssetNameKey(row.assetName) === normalizeAssetNameKey(assetName))
  ), [assetName, weeklyAssetRowsForSource]);
  void splitManagementProjectRows;
  const finalOverviewRows = useMemo(() => mergeBuildingRegisterOverviewRows(
    buildAssetOverviewRows(assetName, project, weeklyRow || {}),
    buildingRegisterSummary,
  ), [assetName, buildingRegisterSummary, project, weeklyRow]);
  const finalInvestmentRows = useMemo(() => buildAssetInvestmentRows(project, weeklyRow || {}), [project, weeklyRow]);
  const fallbackFundInfoRows = useMemo(() => buildDefaultFundInfoRows(assetName, weeklyRow || {}), [assetName, weeklyRow]);
  const effectiveOverviewRows = useMemo(() => mergeBuildingRegisterOverviewRows(
    serverRows?.overview?.length ? serverRows.overview : finalOverviewRows,
    buildingRegisterSummary,
  ), [buildingRegisterSummary, finalOverviewRows, serverRows]);
  const effectiveInvestmentRows = useMemo(() => (
    serverRows?.investment?.length ? normalizeInvestmentRowsForUi(serverRows.investment) : finalInvestmentRows
  ), [finalInvestmentRows, serverRows]);
  const effectiveFundInfoRows = useMemo(() => {
    if (fundAccessBlock) return [];
    return serverFundRows?.fundInfo?.length ? serverFundRows.fundInfo : fallbackFundInfoRows;
  }, [fallbackFundInfoRows, fundAccessBlock, fundReadMode, serverFundRows]);
  const effectiveBeneficiaryRows = useMemo(() => (fundAccessBlock ? [] : serverFundRows?.beneficiaries || []), [fundAccessBlock, fundReadMode, serverFundRows]);
  const effectiveLoanRows = useMemo(() => (fundAccessBlock ? [] : serverFundRows?.loans || []), [fundAccessBlock, fundReadMode, serverFundRows]);
  const assetId = resolveAssetIdByName(assetName);
  const canEditProject = Boolean(permission.role === 'Admin' || (
    assetIdMatchesPermission(assetId, assetName, permission)
    && (permission.permissions?.managedAsset?.update || permission.permissions?.managedAsset?.create || permission.permissions?.managedAsset?.delete)
  ));
  useEffect(() => {
    let cancelled = false;
    const detailCacheKey = assetId || normalizeAssetNameKey(assetName);
    const fundCacheKey = assetId || normalizeAssetNameKey(assetName);
    const cachedDetail = detailCacheKey ? ASSET_PROJECT_DETAIL_CACHE.get(detailCacheKey) : null;
    const cachedFund = fundCacheKey ? ASSET_FUND_OVERVIEW_CACHE.get(fundCacheKey) : null;
    setServerRows(cachedDetail || null);
    setServerFundRows(cachedFund || null);
    setFundAccessBlock(null);
    setFundReadMode(cachedFund ? 'allowed' : assetName ? 'loading' : 'idle');
    setSaveStatus(null);
    if (!assetName) return undefined;
    supabase.functions.invoke('ll-dashboard-api', {
      body: {
        action: 'weekly-projects/get-asset-detail',
        payload: { asset_name: assetName, asset_id: assetId },
      },
    }).then(({ data }) => {
      if (cancelled || !data?.ok || !data?.data) return;
      const nextServerRows = {
        overview: Array.isArray(data.data.overview_rows) ? data.data.overview_rows : [],
        investment: Array.isArray(data.data.investment_rows) ? normalizeInvestmentRowsForUi(data.data.investment_rows) : [],
      };
      if (detailCacheKey) ASSET_PROJECT_DETAIL_CACHE.set(detailCacheKey, nextServerRows);
      setServerRows(nextServerRows);
    }).catch(() => {
      if (!cancelled && !cachedDetail) setServerRows(null);
    });
    supabase.functions.invoke('ll-dashboard-api', {
      body: {
        action: 'funds/read-by-asset',
        payload: { asset_name: assetName, asset_id: assetId },
      },
    }).then(({ data, error }) => {
      if (error) throw error;
      if (cancelled) return;
      if (data?.ok === false) {
        const status = Number(data?.status || data?.status_code || 0);
        const message = data?.message || data?.error || '';
        if (isAuthOrPermissionFailure(status, message)) {
          setFundAccessBlock('펀드개요는 해당 자산 읽기 권한이 확인된 경우에만 표시됩니다.');
          setServerFundRows(null);
          setFundReadMode('blocked');
        } else {
          setFundReadMode('fallback');
        }
        return;
      }
      if (!data?.data) return;
      const nextFundRows = {
        fundInfo: normalizeFundInfoRowsForUi(data.data.fund_info_rows, fallbackFundInfoRows),
        beneficiaries: normalizeFundBeneficiaryRowsForUi(data.data.beneficiary_rows),
        loans: normalizeFundLoanRowsForUi(data.data.loan_rows),
      };
      if (fundCacheKey) ASSET_FUND_OVERVIEW_CACHE.set(fundCacheKey, nextFundRows);
      setServerFundRows(nextFundRows);
      setFundReadMode('allowed');
    }).catch((error) => {
      if (!cancelled) {
        const status = edgeErrorStatus(error);
        const message = error?.message || error?.context?.statusText || '';
        if (isAuthOrPermissionFailure(status, message)) {
          setFundAccessBlock('펀드개요는 해당 자산 읽기 권한이 확인된 경우에만 표시됩니다.');
          setFundReadMode('blocked');
        } else {
          setFundReadMode('fallback');
        }
        if (!cachedFund) setServerFundRows(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [assetName, assetId, fallbackFundInfoRows]);
  useEffect(() => {
    if (!isEditing) {
      setDraftRows({
        overview: effectiveOverviewRows,
        investment: effectiveInvestmentRows,
        fundInfo: effectiveFundInfoRows,
        fundBeneficiaries: effectiveBeneficiaryRows,
        fundLoans: effectiveLoanRows,
      });
    }
  }, [assetName, effectiveBeneficiaryRows, effectiveFundInfoRows, effectiveInvestmentRows, effectiveLoanRows, effectiveOverviewRows, isEditing, serverRows, serverFundRows]);
  const updateProjectDraftCell = (sectionId, rowIndex, cellIndex, value) => {
    setDraftRows((current) => ({
      ...current,
      [sectionId]: (current[sectionId] || []).map((row, index) => (
        index === rowIndex ? row.map((cell, idx) => (idx === cellIndex ? value : cell)) : row
      )),
    }));
  };
  const addProjectDraftRow = (sectionId) => {
    setDraftRows((current) => ({
      ...current,
      [sectionId]: [...(current[sectionId] || []), [sectionId === 'overview' ? '자산' : '기타', '', '']],
    }));
    setOpenSections((current) => ({ ...current, [sectionId]: true }));
  };
  const deleteProjectDraftRow = (sectionId, rowIndex) => {
    setDraftRows((current) => ({
      ...current,
      [sectionId]: (current[sectionId] || []).filter((_, index) => index !== rowIndex),
    }));
  };
  const updateFundInfoCell = (_sectionId, rowIndex, cellIndex, value) => {
    setDraftRows((current) => ({
      ...current,
      fundInfo: (current.fundInfo || []).map((row, index) => (
        index === rowIndex ? row.map((cell, idx) => (idx === cellIndex ? value : cell)) : row
      )),
    }));
  };
  const updateFundBeneficiaryRow = (rowIndex, key, value) => {
    setDraftRows((current) => ({
      ...current,
      fundBeneficiaries: (current.fundBeneficiaries || []).map((row, index) => (
        index === rowIndex ? { ...row, [key]: value } : row
      )),
    }));
  };
  const updateFundLoanRow = (rowIndex, key, value) => {
    setDraftRows((current) => ({
      ...current,
      fundLoans: (current.fundLoans || []).map((row, index) => (
        index === rowIndex ? { ...row, [key]: value } : row
      )),
    }));
  };
  const addFundBeneficiaryRow = () => {
    setDraftRows((current) => ({
      ...current,
      fundBeneficiaries: [...(current.fundBeneficiaries || []), { row_key: `beneficiary_${Date.now()}`, tranche: '', beneficiary_name: '', committed_amount_krw: '' }],
    }));
    setOpenSections((current) => ({ ...current, fund: true }));
  };
  const addFundLoanRow = () => {
    setDraftRows((current) => ({
      ...current,
      fundLoans: [...(current.fundLoans || []), {
        row_key: `loan_${Date.now()}`,
        loan_type: '',
        tranche: '',
        lender_name: '',
        committed_amount_krw: '',
        drawdown_date: '',
        maturity_date: '',
        interest_type: '',
        base_rate: '',
        spread_rate: '',
        loan_rate: '',
        fee_rate: '',
        all_in_rate: '',
      }],
    }));
    setOpenSections((current) => ({ ...current, fund: true }));
  };
  const deleteFundBeneficiaryRow = (rowIndex) => {
    setDraftRows((current) => ({
      ...current,
      fundBeneficiaries: (current.fundBeneficiaries || []).filter((_, index) => index !== rowIndex),
    }));
  };
  const deleteFundLoanRow = (rowIndex) => {
    setDraftRows((current) => ({
      ...current,
      fundLoans: (current.fundLoans || []).filter((_, index) => index !== rowIndex),
    }));
  };
  const startProjectEdit = () => {
    setDraftRows({
      overview: effectiveOverviewRows,
      investment: effectiveInvestmentRows,
      fundInfo: effectiveFundInfoRows,
      fundBeneficiaries: effectiveBeneficiaryRows,
      fundLoans: effectiveLoanRows,
    });
    setOpenSections({ overview: true, investment: true, fund: true });
    setIsEditing(true);
    setSaveStatus(null);
  };
  const saveProjectRows = async () => {
    setSaveStatus({ type: 'pending', message: '자산개요·투자개요·펀드개요를 서버 권한 확인 후 저장 중입니다.' });
    try {
      const { data, error } = await supabase.functions.invoke('ll-dashboard-api', {
        body: {
          action: 'weekly-projects/save-asset-detail',
          payload: {
            asset_id: assetId,
            asset_name: assetName,
            overview_rows: draftRows.overview,
            investment_rows: draftRows.investment,
          },
        },
      });
      if (error) throw error;
      if (data?.ok === false) throw new Error(data.message || '저장 실패');
      const { data: fundData, error: fundError } = await supabase.functions.invoke('ll-dashboard-api', {
        body: {
          action: 'funds/save-by-asset',
          payload: {
            asset_id: assetId,
            asset_name: assetName,
            fund_info_rows: draftRows.fundInfo,
            beneficiary_rows: draftRows.fundBeneficiaries,
            loan_rows: draftRows.fundLoans,
          },
        },
      });
      if (fundError) throw fundError;
      if (fundData?.ok === false) throw new Error(fundData.message || '펀드개요 저장 실패');
      const hasFundResponseRows = Boolean(
        fundData?.data
        && (
          Array.isArray(fundData.data.fund_info_rows)
          || Array.isArray(fundData.data.beneficiary_rows)
          || Array.isArray(fundData.data.loan_rows)
        ),
      );
      const nextFundRows = hasFundResponseRows ? {
        fundInfo: normalizeFundInfoRowsForUi(fundData.data.fund_info_rows, fallbackFundInfoRows),
        beneficiaries: normalizeFundBeneficiaryRowsForUi(fundData.data.beneficiary_rows),
        loans: normalizeFundLoanRowsForUi(fundData.data.loan_rows),
      } : {
        fundInfo: draftRows.fundInfo,
        beneficiaries: draftRows.fundBeneficiaries,
        loans: draftRows.fundLoans,
      };
      const nextProjectRows = { overview: draftRows.overview, investment: draftRows.investment };
      const cacheKey = assetId || normalizeAssetNameKey(assetName);
      if (cacheKey) {
        ASSET_PROJECT_DETAIL_CACHE.set(cacheKey, nextProjectRows);
        ASSET_FUND_OVERVIEW_CACHE.set(cacheKey, nextFundRows);
      }
      setServerRows(nextProjectRows);
      setServerFundRows(nextFundRows);
      setFundAccessBlock(null);
      setFundReadMode('allowed');
      setIsEditing(false);
      setSaveStatus({ type: 'success', message: '자산개요·투자개요는 저장했고, 펀드개요는 관리자 승인 요청으로 접수되었습니다.' });
    } catch (error) {
      setSaveStatus({ type: 'warning', message: `저장 실패: ${error.message || 'll-dashboard-api 배포 또는 권한을 확인해야 합니다.'}` });
    }
  };
  const statusClass = saveStatus?.type === 'success'
    ? 'border-[#2E6B45] bg-[#173522] text-[#B5E48C]'
    : saveStatus?.type === 'warning'
      ? 'border-[#7A6425] bg-[#2B2613] text-[#FFD166]'
      : 'border-[#3A3A3C] bg-[#1F1F1E] text-[#C7C7CC]';

  return (
    <section className={`${modalMode ? 'min-h-[calc(100vh-170px)]' : ''} rounded-[20px] border border-[#333333] bg-[#252524] p-5`}>
      <SectionHeader
        eyebrow="WEEKLY MANAGEMENT PROJECT"
        title="자산개요 · 투자개요 · 펀드개요"
        right={(
          <div className="flex flex-wrap items-center justify-end gap-2">
            {canEditProject && !isEditing ? <button type="button" onClick={startProjectEdit} className={`h-9 rounded-[8px] border px-3 text-[13px] font-semibold ${PRIMARY_BLUE_BUTTON_CLASS}`}>수정</button> : null}
            {isEditing ? (
              <>
                <button type="button" onClick={saveProjectRows} className={`h-9 rounded-[8px] border px-3 text-[13px] font-semibold ${PRIMARY_BLUE_BUTTON_CLASS}`}>저장</button>
                <button type="button" onClick={() => {
                  setIsEditing(false);
                  setSaveStatus(null);
                  setDraftRows({
                    overview: effectiveOverviewRows,
                    investment: effectiveInvestmentRows,
                    fundInfo: effectiveFundInfoRows,
                    fundBeneficiaries: effectiveBeneficiaryRows,
                    fundLoans: effectiveLoanRows,
                  });
                }} className={`h-9 rounded-[8px] border px-3 text-[13px] font-semibold ${DARK_BUTTON_CLASS}`}>취소</button>
              </>
            ) : null}
          </div>
        )}
      />
      {saveStatus ? <div className={`mb-3 rounded-[10px] border px-3 py-2 text-[13px] font-semibold ${statusClass}`}>{saveStatus.message}</div> : null}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <AssetProjectToggleTable id="overview" title="자산개요" rows={isEditing ? draftRows.overview : effectiveOverviewRows} openSections={openSections} onToggle={toggleSection} isEditing={isEditing} onCellChange={updateProjectDraftCell} onAddRow={addProjectDraftRow} onDeleteRow={deleteProjectDraftRow} />
        <AssetProjectToggleTable id="investment" title="투자개요" rows={isEditing ? draftRows.investment : effectiveInvestmentRows} openSections={openSections} onToggle={toggleSection} isEditing={isEditing} onCellChange={updateProjectDraftCell} onAddRow={addProjectDraftRow} onDeleteRow={deleteProjectDraftRow} />
        <AssetFundOverviewTable
          open={openSections.fund}
          onToggle={() => toggleSection('fund')}
          fundInfoRows={isEditing ? draftRows.fundInfo : effectiveFundInfoRows}
          beneficiaryRows={isEditing ? draftRows.fundBeneficiaries : effectiveBeneficiaryRows}
          loanRows={isEditing ? draftRows.fundLoans : effectiveLoanRows}
          blockedMessage={fundAccessBlock}
          isEditing={isEditing}
          onFundInfoCellChange={updateFundInfoCell}
          onBeneficiaryChange={updateFundBeneficiaryRow}
          onBeneficiaryAdd={addFundBeneficiaryRow}
          onBeneficiaryDelete={deleteFundBeneficiaryRow}
          onLoanChange={updateFundLoanRow}
          onLoanAdd={addFundLoanRow}
          onLoanDelete={deleteFundLoanRow}
        />
      </div>
    </section>
  );
}

function WeeklyAssetStatusFullTable({ rows, headers, columnWidths, numericStartIndex = 3, numericEndIndex = 13 }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-[13px] font-semibold text-[#A1A1AA]">전체 {formatNumber(rows.length)}개 자산 · 자산명 열고정 · 가로/세로 스크롤 지원</div>
      </div>
      <div className="custom-scrollbar h-[calc(100vh-190px)] overflow-auto rounded-[12px] border border-[#333333] bg-[#1F1F1E]">
        <table className="min-w-[2240px] table-fixed border-collapse text-left">
          <colgroup>
            {columnWidths.map((width, index) => <col key={`${headers[index]}-${width}`} style={{ width }} />)}
          </colgroup>
          <thead className="sticky top-0 z-20 bg-[#141414] text-[12px] text-[#B0B0B6]">
            <tr>
              {headers.map((header, index) => (
                <th key={header} className={`border-b border-[#333333] px-3 py-3 font-semibold ${index === 0 ? 'sticky left-0 z-30 bg-[#141414] pl-4 text-left' : index >= numericStartIndex && index <= numericEndIndex ? 'text-right' : 'text-left'}`}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ source, cells }, rowIndex) => (
              <tr key={`${source.assetName}-${rowIndex}`} className="border-b border-[#303030] last:border-b-0 hover:bg-white/[0.04]">
                {cells.map((cell, cellIndex) => (
                  <td key={`${source.assetName}-${cellIndex}`} className={`px-3 py-2.5 align-top text-[13px] leading-5 text-[#E5E5E5] ${cellIndex === 0 ? 'sticky left-0 z-10 bg-[#1F1F1E] pl-4 font-semibold shadow-[8px_0_12px_rgba(0,0,0,0.24)]' : ''} ${cellIndex >= numericStartIndex && cellIndex <= numericEndIndex ? 'text-right tabular-nums' : 'text-left'} ${cellIndex === headers.length - 1 ? '' : 'whitespace-nowrap'}`}>
                    <span className={cellIndex === headers.length - 1 ? 'block whitespace-normal break-keep' : 'block truncate'} title={typeof cell === 'string' ? cell : undefined}>
                      {cell}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length ? <div className="p-6 text-[13px] text-[#86868B]">표시할 자산현황이 없습니다.</div> : null}
      </div>
    </div>
  );
}

function WeeklyAssetStatusTable({ title = '관리 Project 현황' }) {
  const { memberInfo } = useAuth();
  const [modal, setModal] = useState(null);
  const [sortConfig, setSortConfig] = useState({ index: 0, direction: 'asc' });
  const permission = useMemo(() => resolveLogisticsPermission(memberInfo), [memberInfo]);
  const [assetRowsDraft, setAssetRowsDraft] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const originalAssetNamesRef = useRef([]);
  const loadedAssetRowsRef = useRef([]);
  const assetRows = assetRowsDraft;
  const canEditWeeklyAssets = Boolean(permission.permissions?.managedAsset?.update || permission.permissions?.managedAsset?.create || permission.permissions?.managedAsset?.delete || permission.role === 'Admin');
  const displayFieldDefs = [
    ['assetName', '자산명', false],
    ['fundName', '펀드명', false],
    ['category', '구분', false],
    ['grossAreaPy', '연면적(평)', true],
    ['completion', '준공', false],
    ['investmentType', '투자유형', false],
    ['acquisition', '매입시점', false],
    ['leaseMaturity', '임대차만기', false],
    ['fundMaturity', '펀드만기', false],
    ['loanMaturity', '대출만기', false],
    ['costPerPy', '원가', true],
    ['costTrend', '현재 대비', true],
    ['coldRatio', '저온비율', true],
    ['occupancyRate', '임대율', true],
    ['mainTenant', '주요 임차인', false],
    ['mainIssue', 'Main Issue', false],
  ].map(([key, header, numeric]) => ({ key, header, numeric }));
  const activeFieldDefs = displayFieldDefs;
  const fullHeaders = activeFieldDefs.map((field) => field.header);
  useEffect(() => {
    let cancelled = false;
    const applyRows = (rows) => {
      setAssetRowsDraft(rows);
      loadedAssetRowsRef.current = rows;
      originalAssetNamesRef.current = rows.map((row) => row.assetName).filter(Boolean);
    };
    const fetchRows = async () => {
      let rows = [];
      try {
        const { data, error } = await supabase.functions.invoke('ll-dashboard-api', {
          body: { action: 'weekly-assets/latest', payload: {} },
        });
        if (error || data?.ok === false) throw error || new Error(data?.message || 'weekly asset read failed');
        rows = normalizeWeeklyAssetRows(data?.data?.rows || []);
      } catch {
        rows = [];
      }
      if (!rows.length) {
        try {
          const { data, error } = await supabase.functions.invoke('ll-dashboard-api', {
            body: {
              action: 'weekly-assets/latest-preview',
              payload: { email: permission.email || memberInfo?.email || '' },
            },
          });
          if (error || data?.ok === false) throw error || new Error(data?.message || 'weekly asset preview read failed');
          rows = normalizeWeeklyAssetRows(data?.data?.rows || []);
        } catch {
          rows = [];
        }
      }
      if (!cancelled) applyRows(rows);
    };
    fetchRows();
    return () => {
      cancelled = true;
    };
  }, [memberInfo?.email, permission.email, permission.role]);
  const canEditWeeklyAssetRow = (row) => (
    permission.role === 'Admin'
    || (
      (!cleanDisplay(row.assetName, '') && Boolean(permission.permissions?.managedAsset?.create))
      || assetIdMatchesPermission(resolveAssetIdByName(row.assetName), row.assetName, permission)
    ) && Boolean(permission.permissions?.managedAsset?.update || permission.permissions?.managedAsset?.create || permission.permissions?.managedAsset?.delete)
  );
  const updateDraftCell = (rowIndex, key, value) => {
    setAssetRowsDraft((rows) => rows.map((row, index) => (index === rowIndex ? { ...row, [key]: value } : row)));
  };
  const addDraftRow = () => {
    setAssetRowsDraft((rows) => [
      ...rows,
      {
        id: `draft-${Date.now()}`,
        assetName: '',
        fundName: '',
        category: '',
        grossAreaPy: '',
        completion: '',
        investmentType: '',
        acquisition: '',
        leaseMaturity: '',
        fundMaturity: '',
        loanMaturity: '',
        costPerPy: '',
        costTrend: '',
        coldRatio: '',
        occupancyRate: '',
        mainTenant: '',
        mainIssue: '',
      },
    ]);
  };
  const removeDraftRow = (rowIndex) => setAssetRowsDraft((rows) => rows.filter((_, index) => index !== rowIndex));
  const saveDraftRows = async () => {
    setSaveStatus({ type: 'pending', message: '자산현황 수정 내용을 서버 권한 확인 후 저장 중입니다.' });
    try {
      const rows = assetRowsDraft.filter((row) => cleanDisplay(row.assetName, ''));
      const { data, error } = await supabase.functions.invoke('ll-dashboard-api', {
        body: {
          action: 'weekly-assets/replace-latest',
          payload: {
            original_asset_names: originalAssetNamesRef.current,
            rows,
          },
        },
      });
      if (error) throw error;
      if (data?.ok === false) throw new Error(data.message || '저장 실패');
      originalAssetNamesRef.current = rows.map((row) => row.assetName).filter(Boolean);
      loadedAssetRowsRef.current = rows;
      setAssetRowsDraft(rows);
      setIsEditing(false);
      setSaveStatus({ type: 'success', message: `저장 완료: ${data?.data?.inserted ?? rows.length}건 반영` });
    } catch (error) {
      setSaveStatus({ type: 'warning', message: `저장 실패: ${error.message || 'll-dashboard-api 연결 또는 권한을 확인해야 합니다.'}` });
    }
  };
  const sortableRows = useMemo(() => {
    const rows = assetRows.map((row, originalIndex) => ({
      source: row,
      originalIndex,
      cells: activeFieldDefs.map((field) => (
        field.key === 'grossAreaPy'
          ? formatNumber(row[field.key])
          : cleanDisplay(row[field.key], field.key.includes('Maturity') ? '-' : '')
      )),
    }));
    if (isEditing) return rows;
    return rows.sort((left, right) => compareSortableCells(left.cells[sortConfig.index], right.cells[sortConfig.index], sortConfig.direction));
  }, [assetRows, activeFieldDefs, isEditing, sortConfig]);
  const toggleSort = (index) => {
    setSortConfig((current) => ({
      index,
      direction: current.index === index && current.direction === 'asc' ? 'desc' : 'asc',
    }));
  };
  const openAssetDetail = (row) => setModal({
    title: `자산현황 상세 · ${row.assetName}`,
    headers: ['항목', '내용'],
    rows: assetDetailRows(row),
  });
  const columnWidths = ['190px', '230px', '110px', '110px', '90px', '110px', '110px', '120px', '120px', '120px', '100px', '100px', '100px', '100px', '170px', '360px'];
  const visibleHeaders = isEditing ? [...fullHeaders, '관리'] : fullHeaders;
  const visibleColumnWidths = isEditing ? [...columnWidths, '92px'] : columnWidths;
  const statusClass = saveStatus?.type === 'success'
    ? 'border-[#2E6B45] bg-[#173522] text-[#B5E48C]'
    : saveStatus?.type === 'warning'
      ? 'border-[#7A6425] bg-[#2B2613] text-[#FFD166]'
      : 'border-[#3A3A3C] bg-[#1F1F1E] text-[#C7C7CC]';

  return (
    <section className="mb-[28px] rounded-[24px] border border-[#333333] bg-[#252524] p-5">
      <LogisticsModal modal={modal} onClose={() => setModal(null)} />
      <SectionHeader
        eyebrow="ASSET STATUS"
        title={title}
        right={(
          <div className="flex flex-wrap items-center justify-end gap-2">
            {!isEditing ? (
              <button
                type="button"
                onClick={() => setModal({
                  title,
                  size: 'fullscreen',
                  content: <WeeklyAssetStatusFullTable rows={sortableRows} headers={fullHeaders} columnWidths={columnWidths} />,
                })}
                className={`h-9 rounded-[8px] border px-3 text-[13px] font-semibold ${DARK_BUTTON_CLASS}`}
              >
                큰 표 보기
              </button>
            ) : null}
            {canEditWeeklyAssets && !isEditing ? (
              <button
                type="button"
                onClick={() => { setIsEditing(true); setSaveStatus(null); }}
                className={`h-9 rounded-[8px] border px-3 text-[13px] font-semibold ${PRIMARY_BLUE_BUTTON_CLASS}`}
              >
                수정
              </button>
            ) : null}
            {isEditing ? (
              <>
                <button type="button" onClick={addDraftRow} className={`h-9 rounded-[8px] border px-3 text-[13px] font-semibold ${DARK_BUTTON_CLASS}`}>행 추가</button>
                <button type="button" onClick={saveDraftRows} className={`h-9 rounded-[8px] border px-3 text-[13px] font-semibold ${PRIMARY_BLUE_BUTTON_CLASS}`}>저장</button>
                <button
                  type="button"
                  onClick={() => {
                    setAssetRowsDraft(loadedAssetRowsRef.current);
                    setIsEditing(false);
                    setSaveStatus(null);
                  }}
                  className={`h-9 rounded-[8px] border px-3 text-[13px] font-semibold ${DARK_BUTTON_CLASS}`}
                >
                  취소
                </button>
              </>
            ) : null}
          </div>
        )}
      />
      {saveStatus ? (
        <div className={`mb-3 rounded-[10px] border px-3 py-2 text-[13px] font-semibold ${statusClass}`}>
          {saveStatus.message}
        </div>
      ) : null}
      <div className="custom-scrollbar max-h-[540px] overflow-auto rounded-[10px] border border-[#333333]">
        <table className={`${isEditing ? 'min-w-[2340px]' : 'min-w-[2240px]'} table-fixed border-collapse text-left`}>
          <colgroup>
            {visibleColumnWidths.map((width, index) => <col key={`${visibleHeaders[index]}-${width}`} style={{ width }} />)}
          </colgroup>
          <thead className="sticky top-0 z-20 bg-[#1F1F1E] text-[12px] text-[#86868B]">
            <tr>
              {visibleHeaders.map((header, index) => (
                <th key={header} className={`px-3 py-2 font-semibold ${index === 0 ? 'sticky left-0 z-30 bg-[#1F1F1E] pl-4 text-left' : index >= 3 && index <= 13 ? 'text-right' : 'text-left'}`}>
                  {index < fullHeaders.length ? (
                    <button
                      type="button"
                      onClick={() => !isEditing && toggleSort(index)}
                      className={`flex w-full items-center gap-1 text-[12px] font-semibold transition-colors hover:text-white ${isEditing ? 'cursor-default' : 'cursor-pointer'} ${index >= 3 && index <= 13 ? 'justify-end' : 'justify-start'}`}
                      title={isEditing ? '수정 중에는 정렬을 잠시 고정합니다.' : `${header} 기준 정렬`}
                    >
                      <span className="truncate">{header}</span>
                      {!isEditing ? (
                        <span className={`text-[10px] ${sortConfig.index === index ? 'text-white' : 'text-[#5f5f64]'}`}>
                          {sortConfig.index === index ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '↕'}
                        </span>
                      ) : null}
                    </button>
                  ) : (
                    <span className="block text-center">{header}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortableRows.map(({ source, cells, originalIndex }, rowIndex) => {
              const editableRow = isEditing && canEditWeeklyAssetRow(source);
              return (
              <tr
                key={`${source.assetName}-${rowIndex}`}
                onClick={() => !isEditing && openAssetDetail(source)}
                className={`${isEditing ? '' : 'cursor-pointer'} border-b border-[#333333] last:border-b-0 hover:bg-white/[0.04]`}
              >
                {cells.map((cell, cellIndex) => (
                  <td
                    key={`${source.assetName}-${cellIndex}`}
                    className={`px-3 py-2 align-top text-[13px] leading-5 text-[#E5E5E5] ${cellIndex === 0 ? 'sticky left-0 z-10 bg-[#252524] pl-4 font-semibold shadow-[8px_0_12px_rgba(0,0,0,0.22)]' : ''} ${cellIndex >= 3 && cellIndex <= 13 ? 'text-right tabular-nums' : 'text-left'} ${cellIndex === 15 ? '' : 'whitespace-nowrap'}`}
                  >
                    {editableRow ? (
                      <input
                        value={source[activeFieldDefs[cellIndex].key] ?? ''}
                        onChange={(event) => updateDraftCell(originalIndex, activeFieldDefs[cellIndex].key, event.target.value)}
                        className={`h-9 w-full rounded-[8px] border border-[#3A3A3C] bg-[#111111] px-2 text-[13px] text-white outline-none focus:border-[#2997ff] ${cellIndex >= 3 && cellIndex <= 13 ? 'text-right tabular-nums' : 'text-left'}`}
                      />
                    ) : (
                      <span className={cellIndex === 15 ? 'block whitespace-normal break-keep' : 'block truncate'} title={typeof cell === 'string' ? cell : undefined}>
                        {cell}
                      </span>
                    )}
                  </td>
                ))}
                {isEditing ? (
                  <td className="px-3 py-2 align-top text-center">
                    <button
                      type="button"
                      disabled={!editableRow}
                      onClick={() => removeDraftRow(originalIndex)}
                      className={`h-8 rounded-[8px] border px-2 text-[12px] font-semibold ${editableRow ? 'border-[#5A2A2A] bg-[#2B1515] text-[#FFB4B4] hover:bg-[#3A1D1D]' : 'cursor-not-allowed border-[#333333] bg-[#1F1F1E] text-[#5F5F64]'}`}
                    >
                      삭제
                    </button>
                  </td>
                ) : null}
              </tr>
              );
            })}
          </tbody>
        </table>
        {!sortableRows.length ? <div className="p-5 text-[13px] text-[#86868B]">표시할 자산현황이 없습니다.</div> : null}
      </div>
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

function hasAllAssetReadPermission(permission) {
  const role = String(permission?.role || permission?.logisticsRole || '').trim();
  return Boolean(
    permission?.permissions?.otherAsset?.read
    || role === 'Admin'
    || role === 'System Admin',
  );
}

function assetMatchesPermission(assetName, permission) {
  if (hasAllAssetReadPermission(permission)) return true;
  const key = normalizeAssetNameKey(assetName);
  if (!key) return true;
  return (permission.managedAssets || []).some((asset) => {
    const assetKey = normalizeAssetNameKey(asset.assetName);
    return assetKey && (assetKey.includes(key) || key.includes(assetKey));
  });
}

function assetIdMatchesPermission(assetId, assetName, permission) {
  if (hasAllAssetReadPermission(permission)) return true;
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

function buildMainWeeklyTasks(report, permission) {
  const rows = [...(report.newProjects || []), ...(report.managementProjects || [])];
  return rows.slice(0, 6).map((row, index) => {
    const meta = inferMainTaskMeta(row, index);
    const assetName = cleanDisplay(row.assetName || row.projectName, '');
    const managedAsset = (permission.managedAssets || []).find((asset) => assetMatchesPermission(assetName || asset.assetName, { managedAssets: [asset] }));
    return {
      id: row.id || `main-task-${index + 1}`,
      seedId: row.id || `main-task-${index + 1}`,
      taskName: cleanDisplay(row.projectName || row.assetName, `Weekly Task ${index + 1}`),
      nextAction: trimMainText(row.plan || row.issue || row.status || '후속 액션 확인 필요'),
      issue: trimMainText(row.issue || row.status || '주요 이슈 없음', 108),
      assetName: managedAsset?.assetName || assetName || '-',
      fundName: managedAsset?.fundName || row.fundName || '',
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

function filterMainTasksByPermission(tasks, permission, showCompleted) {
  return (tasks || []).filter((task) => {
    if (task.status === 'deleted') return false;
    if (!showCompleted && (task.completed || task.status === '완료' || task.status === 'completed')) return false;
    if (assetMatchesPermission(task.assetName || task.relatedAsset, permission)) return true;
    if (task.createdByEmail === permission.email || task.createdByName === permission.name) return true;
    return Boolean(task.organization && task.organization === permission.organization && !task.assetName);
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
  const seedId = payload.seedId || payload.seed_id || payload.seedTaskId || payload.sourceTaskId || '';
  return {
    id: row.id,
    seedId,
    taskName: cleanDisplay(taskName, 'Task'),
    nextAction: cleanDisplay(nextAction, ''),
    issue: cleanDisplay(row.issue || payload.issue, ''),
    notes: cleanDisplay(row.notes || payload.notes, ''),
    assetName: cleanDisplay(assetName, '-'),
    relatedAsset: cleanDisplay(assetName, '-'),
    fundName: payload.fundName || option?.fundName || '',
    createdByName: row.created_by_name || payload.createdByName || permission.name,
    createdByEmail: row.created_by_email || payload.createdByEmail || permission.email,
    organization: row.organization || payload.organization || permission.organization,
    stakeholder: companyName || '????',
    companyName,
    dueDate: row.due_date || payload.dueDate || '',
    status: normalizeLogisticsTaskStatus(row.status || payload.status),
    priority: payload.priority || row.priority || '??',
    completed: row.status === 'completed' || Boolean(row.completed_at) || payload.completed,
    deleted: row.status === 'deleted' || Boolean(row.deleted_at) || payload.deleted,
    createdAt: row.created_at || payload.createdAt || '',
    source: payload.source || 'll_work_items',
  };
}

function taskSeedId(task) {
  return String(task?.seedId || (/^main-task-/u.test(String(task?.id || '')) ? task.id : '') || '').trim();
}

function isSeedTask(task) {
  return task?.source === 'weekly_report_seed' || Boolean(taskSeedId(task));
}

function isDeletedTask(task) {
  return task?.deleted || ['deleted', '삭제'].includes(String(task?.status || '').toLowerCase());
}

function buildTaskStakeholderOptions(taskRows = [], stakeholderRows = []) {
  const candidates = [];
  companyOptionsData.forEach((company) => {
    candidates.push(company.tenantMasterName, company.companyName, company.displayName);
  });
  (stakeholderRows || []).forEach((row) => {
    candidates.push(row.company_name, row.contact_name, row.stakeholder_name);
  });
  [...(weeklyReportData.newProjects || []), ...(weeklyReportData.managementProjects || []), ...(weeklyReportData.assetRows || [])].forEach((row) => {
    candidates.push(row.stakeholder, row.tenantName, row.companyName, row.ownerName);
  });
  (taskRows || []).forEach((task) => {
    candidates.push(task.companyName, task.stakeholder);
  });
  const unique = new Map();
  candidates
    .map((value) => cleanDisplay(value, ''))
    .filter((value) => value && value !== '-')
    .forEach((value) => {
      const key = value.replace(/\s+/gu, '').toLowerCase();
      if (!unique.has(key)) unique.set(key, value);
    });
  return [...unique.values()].sort((a, b) => a.localeCompare(b, 'ko-KR'));
}

function filterTaskStakeholderOptions(options, query) {
  const normalizedQuery = String(query || '').replace(/\s+/gu, '').toLowerCase();
  if (!normalizedQuery) return [];
  return (options || [])
    .filter((option) => String(option || '').replace(/\s+/gu, '').toLowerCase().includes(normalizedQuery))
    .slice(0, 8);
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

function TaskStakeholderSearchInput({ value, onChange, options }) {
  const [isOpen, setIsOpen] = useState(false);
  const filteredOptions = useMemo(() => filterTaskStakeholderOptions(options, value), [options, value]);
  const hasQuery = String(value || '').trim().length > 0;

  return (
    <div className="relative flex-1">
      <input
        type="text"
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => window.setTimeout(() => setIsOpen(false), 160)}
        className="w-full rounded-[12px] border border-[#444] bg-[#1A1A1A] px-4 py-3 text-[16px] text-white outline-none focus:border-[#888]"
        placeholder="이해관계자 검색"
        autoComplete="off"
      />
      {isOpen && hasQuery ? (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-[190px] w-full overflow-y-auto rounded-[12px] border border-[#444] bg-[#2A2A2A] py-2 shadow-xl">
          {filteredOptions.length ? filteredOptions.map((option) => (
            <button
              key={option}
              type="button"
              onMouseDown={(event) => {
                event.preventDefault();
                onChange(option);
                setIsOpen(false);
              }}
              className="block w-full cursor-pointer px-4 py-2 text-left text-[14px] text-white transition-colors hover:bg-[#3b82f6]"
            >
              {option}
            </button>
          )) : (
            <div className="px-4 py-2 text-[13px] leading-5 text-[#A1A1AA]">
              검색 결과가 없습니다. 입력한 명칭은 그대로 저장됩니다.
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default function WorkspaceLogistics({ currentPath = '' }) {
  const { user, memberInfo } = useAuth();
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
  const taskSnapshotSyncRef = useRef('');
  const [selectedSearchResult, setSelectedSearchResult] = useState(null);
  const [taskRecords, setTaskRecords] = useState([]);
  const [stakeholderMasterRows, setStakeholderMasterRows] = useState([]);
  const [taskEditTarget, setTaskEditTarget] = useState(null);
  const [taskDraft, setTaskDraft] = useState(null);
  const [pendingTaskAction, setPendingTaskAction] = useState(null);
  const [taskSaveStatus, setTaskSaveStatus] = useState(null);

  const isContractData = normalizeLogisticsPath(currentPath) === pathFor('contract-data');
  const isDashboard = currentPath.startsWith(pathFor('dashboard'));
  const isPdfReport = currentPath.startsWith(pathFor('pdf-report'));
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
          body: { action: 'work-platform/tasks/list', payload: { workspace: 'logistics', include_deleted: true } },
        });
        if (error) throw error;
        if (data?.ok === false) throw new Error(data.message || 'TASK 목록을 불러오지 못했습니다.');
        const rows = Array.isArray(data?.data) ? data.data.map((row) => normalizeServerWorklogTask(row, permission)) : [];
        if (!cancelled) {
          const archivedSeedIds = new Set(rows.filter((task) => isDeletedTask(task) && taskSeedId(task)).map((task) => taskSeedId(task)));
          const materializedSeedIds = new Set(rows.filter((task) => !isDeletedTask(task) && taskSeedId(task)).map((task) => taskSeedId(task)));
          const activeRows = rows.filter((task) => !isDeletedTask(task));
          const visibleSeedTasks = weeklyTasks.filter((task) => {
            const seedId = taskSeedId(task);
            return seedId && !archivedSeedIds.has(seedId) && !materializedSeedIds.has(seedId);
          });
          setTaskRecords([...activeRows, ...visibleSeedTasks]);
        }
      } catch {
        if (!cancelled) {
          setTaskRecords([]);
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
    if (isLoadingTasks || !permission.email) return undefined;
    const activeTaskSignature = taskRecords
      .filter((task) => !isDeletedTask(task))
      .map((task) => `${task.id}:${task.status}:${task.createdAt || ''}:${task.updatedAt || ''}`)
      .join('|');
    const seedSignature = weeklyTasks.map((task) => `${taskSeedId(task)}:${task.assetName}:${task.taskName}`).join('|');
    const signature = `${permission.email}|${activeTaskSignature}|${seedSignature}`;
    if (taskSnapshotSyncRef.current === signature) return undefined;
    taskSnapshotSyncRef.current = signature;
    let cancelled = false;
    const syncSnapshot = async () => {
      try {
        await supabase.functions.invoke('ll-dashboard-api', {
          body: {
            action: 'work-platform/tasks/snapshots/upsert-current',
            payload: {
              workspace: 'logistics',
              seed_tasks: weeklyTasks,
            },
          },
        });
      } catch (error) {
        if (!cancelled) console.warn('Failed to sync logistics task snapshot:', error);
      }
    };
    syncSnapshot();
    return () => {
      cancelled = true;
    };
  }, [isLoadingTasks, permission.email, taskRecords, weeklyTasks]);

  useEffect(() => {
    let cancelled = false;
    const fetchStakeholderMasterRows = async () => {
      try {
        const { data, error } = await supabase
          .from('iota_stakeholder_master')
          .select('company_name, contact_name, role_category')
          .limit(5000);
        if (!cancelled && !error && Array.isArray(data)) setStakeholderMasterRows(data);
      } catch {
        if (!cancelled) setStakeholderMasterRows([]);
      }
    };
    fetchStakeholderMasterRows();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    aiChatScrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [aiChatMessages, aiChatLoading, isAiDockOpen]);

  useEffect(() => {
    if (!aiToast) return undefined;
    const timer = window.setTimeout(() => setAiToast(null), 2200);
    return () => window.clearTimeout(timer);
  }, [aiToast]);

  const permittedTasks = useMemo(() => filterMainTasksByPermission(taskRecords, permission, showCompletedTasks), [permission, showCompletedTasks, taskRecords]);
  const sortedWeeklyTasks = useMemo(() => sortMainTasks(permittedTasks), [permittedTasks]);
  const visibleTasks = showAllTasks ? sortedWeeklyTasks : sortedWeeklyTasks.slice(0, 5);
  const topAssets = useMemo(() => [...(permission.managedAssets || [])].sort((a, b) => String(a.assetName || '').localeCompare(String(b.assetName || ''), 'ko-KR')), [permission.managedAssets]);
  const searchResults = useMemo(() => buildLogisticsSearchResults(mainSearchQuery, permission), [mainSearchQuery, permission]);
  const taskStakeholderOptions = useMemo(() => buildTaskStakeholderOptions(taskRecords, stakeholderMasterRows), [stakeholderMasterRows, taskRecords]);

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
    try {
      const action = operation === 'create'
        ? 'work-platform/tasks'
        : operation === 'seed-delete'
          ? 'work-platform/tasks/archive-seed'
          : `work-platform/tasks/${operation}`;
      const assetName = payload.assetName || task.assetName;
      const { data, error } = await supabase.functions.invoke('ll-dashboard-api', {
        body: {
          action,
          payload: {
            id: task.id,
            seed_id: payload.seedId || taskSeedId(task) || undefined,
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
            payload: { ...task, ...payload, seedId: payload.seedId || taskSeedId(task) || undefined, assetName, relatedAsset: assetName, source: payload.source || task.source || 'main_task_manager' },
          },
        },
      });
      if (error) throw error;
      if (data?.ok === false) throw new Error(data.message || '서버 저장 실패');
      return { ok: true, data: data?.data || null };
    } catch (error) {
      return { ok: false, error };
    }
  };
  const taskOperationErrorMessage = (error) => {
    const message = String(error?.message || '');
    if (/authorization|401|missing authorization|invalid authorization/iu.test(message)) return '로그인 세션을 확인하지 못해 저장하지 못했습니다. 새로고침 후 다시 로그인해 주세요.';
    if (/403|permission|insufficient/iu.test(message)) return '이 자산에 대한 추가/수정/삭제 권한이 없어 저장하지 못했습니다.';
    if (/related_asset_id|asset/iu.test(message)) return '저장할 담당 자산을 확인하지 못했습니다. 담당 자산을 다시 선택해 주세요.';
    return message || '저장 중 오류가 발생했습니다.';
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
    });
    setIsAddingTask(true);
    document.getElementById('task-management')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const startTaskAdd = () => {
    if (!canRegisterTask) {
      setTaskSaveStatus({ type: 'error', message: '현재 계정에는 TASK 추가 권한이 없습니다.' });
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
    setTaskSaveStatus(null);
    setIsAddingTask(true);
  };
  const saveTaskEdit = async () => {
    if (!taskDraft?.taskName?.trim()) {
      setTaskSaveStatus({ type: 'error', message: 'Task 제목을 입력해야 저장할 수 있습니다.' });
      return;
    }
    if (!taskDraft?.assetName) {
      setTaskSaveStatus({ type: 'error', message: '담당 자산을 선택해야 저장할 수 있습니다.' });
      return;
    }
    setTaskSaveStatus({ type: 'pending', message: 'TASK를 저장하는 중입니다.' });
    const now = new Date().toISOString();
    if (taskEditTarget) {
      if (!canModifyTask(taskEditTarget)) return;
      const editingSeedTask = isSeedTask(taskEditTarget);
      const result = await submitTaskOperation(
        editingSeedTask ? 'create' : 'update',
        taskEditTarget,
        editingSeedTask
          ? { ...taskDraft, seedId: taskSeedId(taskEditTarget), source: 'weekly_report_seed' }
          : taskDraft,
      );
      if (!result.ok) {
        setTaskSaveStatus({ type: 'error', message: taskOperationErrorMessage(result.error) });
        return;
      }
      const nextTask = result.data
        ? normalizeServerWorklogTask(result.data, permission)
        : { ...taskEditTarget, ...taskDraft, stakeholder: taskDraft.companyName || '내부업무', relatedAsset: taskDraft.assetName, createdAt: taskEditTarget.createdAt || now };
      setTaskRecords((tasks) => (
        editingSeedTask
          ? [nextTask, ...tasks.filter((task) => task.id !== taskEditTarget.id)]
          : tasks.map((task) => (task.id === taskEditTarget.id ? nextTask : task))
      ));
    } else {
      const localTask = {
        ...taskDraft,
        id: '',
        createdAt: now,
        createdByName: permission.name,
        createdByEmail: permission.email,
        organization: permission.organization,
        stakeholder: taskDraft.companyName || '내부업무',
        relatedAsset: taskDraft.assetName,
        completed: false,
        source: 'local_pending',
      };
      const result = await submitTaskOperation('create', localTask, taskDraft);
      if (!result.ok) {
        setTaskSaveStatus({ type: 'error', message: taskOperationErrorMessage(result.error) });
        return;
      }
      const savedTask = result.data ? normalizeServerWorklogTask(result.data, permission) : { ...localTask, id: `local-logistics-task-${Date.now()}` };
      setTaskRecords((tasks) => [savedTask, ...tasks]);
    }
    setTaskEditTarget(null);
    setTaskDraft(null);
    setTaskSaveStatus({ type: 'success', message: 'TASK가 저장되었습니다.' });
    setIsAddingTask(false);
  };
  const completeTask = async (task) => {
    if (!canModifyTask(task)) return;
    const nextTask = { ...task, completed: true, status: '완료' };
    const result = await submitTaskOperation(
      isSeedTask(task) ? 'create' : 'complete',
      task,
      { status: 'completed', completed: true, seedId: taskSeedId(task) || undefined, source: isSeedTask(task) ? 'weekly_report_seed' : task.source },
    );
    if (!result.ok) {
      setTaskSaveStatus({ type: 'error', message: taskOperationErrorMessage(result.error) });
      return;
    }
    const savedTask = result.data ? normalizeServerWorklogTask(result.data, permission) : nextTask;
    setTaskRecords((tasks) => tasks.map((item) => (item.id === task.id ? savedTask : item)));
  };
  const deleteTask = async (task) => {
    if (!canModifyTask(task)) return;
    const result = await submitTaskOperation(
      isSeedTask(task) ? 'seed-delete' : 'delete',
      task,
      { status: 'deleted', deleted: true, seedId: taskSeedId(task) || undefined, source: isSeedTask(task) ? 'weekly_report_seed' : task.source },
    );
    if (!result.ok) {
      setTaskSaveStatus({ type: 'error', message: taskOperationErrorMessage(result.error) });
      return;
    }
    setTaskRecords((tasks) => tasks.filter((item) => item.id !== task.id));
  };
  const invokeLogisticsAiFunction = async (action, payload, { timeoutMs = 30000, allowOkFalse = false } = {}) => {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    if (sessionError || !accessToken) {
      const error = new Error('로그인 세션을 확인하지 못했습니다. 새로고침 후 다시 로그인해 주세요.');
      error.context = { status: 401 };
      throw error;
    }
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${supabaseUrl.replace(/\/$/u, '')}/functions/v1/ll-dashboard-api`, {
        method: 'POST',
        headers: {
          apikey: supabaseAnonKey,
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ action, payload }),
        signal: controller.signal,
      });
      const text = await response.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = { message: text.slice(0, 300) };
      }
      if (!response.ok || (!allowOkFalse && data?.ok === false)) {
        const error = new Error(data?.message || data?.error || `AI request failed (${response.status})`);
        error.context = { status: response.status };
        error.data = data;
        throw error;
      }
      return data;
    } catch (error) {
      if (error?.name === 'AbortError') {
        const timeoutError = new Error('AI 답변 시간이 길어져 요청을 중단했습니다. 잠시 뒤 다시 시도해 주세요.');
        timeoutError.context = { status: 408 };
        throw timeoutError;
      }
      throw error;
    } finally {
      window.clearTimeout(timeoutId);
    }
  };

  const describeAiFunctionError = (error, data = null) => {
    const status = data?.provider_status || data?.status || error?.context?.status || error?.status || null;
    const providerError = data?.detail?.provider_error || data?.provider_error || data?.message || '';
    const rawMessage = `${error?.message || ''} ${providerError || ''}`.trim();
    if (/Failed to send a request to the Edge Function/i.test(rawMessage)) {
      return `AI 서버 호출이 실패했습니다. 네트워크 연결이나 배포 URL 허용 설정을 확인해야 합니다. (${rawMessage})`;
    }
    if (status === 401) return '로그인 세션을 확인하지 못했습니다. 새로고침 후 다시 로그인해 주세요.';
    if (status === 403) return '현재 로그인 권한으로는 이 챗봇 데이터를 읽을 수 없습니다.';
    if (status === 408) return rawMessage || 'AI 답변 시간이 길어져 요청을 중단했습니다. 잠시 뒤 다시 시도해 주세요.';
    if (/spending cap|spend cap|monthly spending/iu.test(rawMessage)) return 'AI 답변 생성 한도 문제로 응답이 지연되고 있습니다. 숫자형 질문은 내부 데이터 기준 답변으로 우선 처리됩니다.';
    if (status === 429 || /quota|rate limit|exceeded/iu.test(rawMessage)) return 'AI 답변 요청이 일시적으로 많습니다. 잠시 뒤 다시 시도해 주세요.';
    if (/Google AI key is not configured/i.test(rawMessage)) {
      return 'AI 답변 설정이 아직 완료되지 않았습니다.';
    }
    if (status >= 500 || /provider request failed/i.test(rawMessage)) {
      return `AI 답변 서버에서 오류가 발생했습니다. (${rawMessage || status || 'unknown error'})`;
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
      const data = await invokeLogisticsAiFunction(
        'ai/provider-diagnostics',
        { source: 'workspace-chatbot' },
        { timeoutMs: 18000, allowOkFalse: true },
      );
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
    if (user?.is_demo !== true) return false;
    const hostname = window.location.hostname;
    return hostname === 'localhost' || hostname === '127.0.0.1';
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
    const history = aiChatMessages
      .filter((message) => ['user', 'assistant'].includes(message.role) && message.content)
      .slice(-8)
      .map((message) => ({ role: message.role, content: message.content }));
    try {
      let responseData = null;
      let primaryError = null;
      try {
        responseData = await invokeLogisticsAiFunction(
          'ai/search-chat',
          { question, history },
          { timeoutMs: 30000 },
        );
        if (!responseData?.ok) {
          primaryError = new Error(responseData?.message || 'AI primary action failed');
          primaryError.data = responseData;
        }
      } catch (error) {
        primaryError = error;
      }
      if ((primaryError || !responseData?.ok) && canUsePreviewAiFallback()) {
        try {
          const demoResult = await supabase.functions.invoke('ll-dashboard-api', {
            body: { action: 'ai/search-chat-demo', payload: { question, history } },
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
        evidence: [],
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

  if (isContractData) {
    return (
      <div className="w-full max-w-[1480px] mx-auto px-8 pt-8 pb-14">
        <ContractDataManagementDashboard />
      </div>
    );
  }

  if (isPdfReport) {
    return <PdfReportBuilder />;
  }

  if (isDashboard) {
    return <DashboardShell activeModule={MODULES.some((item) => item.id === activeModule) ? activeModule : 'home'} />;
  }

  return (
    <div className={`w-full max-w-[1200px] px-8 pt-[50px] pb-[70px] transition-[margin,max-width,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${isAiDockOpen ? 'xl:ml-8 xl:mr-[420px] xl:max-w-[calc(100vw-760px)]' : 'mx-auto'}`}>
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
              <span className="mt-[2px]">주요 TASK 관리</span>
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
                  <TaskStakeholderSearchInput
                    value={taskDraft.companyName}
                    onChange={(nextValue) => setTaskDraft((draft) => ({ ...draft, companyName: nextValue }))}
                    options={taskStakeholderOptions}
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
                    <button type="button" onClick={() => { setIsAddingTask(false); setTaskEditTarget(null); setTaskDraft(null); setTaskSaveStatus(null); }} className="rounded-[10px] border border-[#444] bg-[#3c3c3c]/50 px-5 py-2 text-[14px] font-bold text-[#86868B] transition-colors hover:bg-[#3c3c3c] hover:text-white">취소</button>
                    <button type="button" onClick={saveTaskEdit} className="rounded-[10px] border border-[#059669]/30 bg-[#059669]/20 px-5 py-2 text-[14px] font-bold text-[#34d399] transition-colors hover:bg-[#059669]/40">
                      {taskEditTarget ? '수정 완료' : '저장'}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {taskSaveStatus ? (
              <div className={`mb-3 rounded-[12px] border px-4 py-3 text-[13px] font-semibold ${
                taskSaveStatus.type === 'success'
                  ? 'border-[#2E6B45] bg-[#12351F] text-[#B5E48C]'
                  : taskSaveStatus.type === 'pending'
                    ? 'border-[#365C91] bg-[#16253A] text-[#9CC7FF]'
                    : 'border-[#7A5C10] bg-[#2A2309] text-[#F7D774]'
              }`}>
                {taskSaveStatus.message}
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
                            <TaskStakeholderSearchInput
                              value={taskDraft.companyName}
                              onChange={(nextValue) => setTaskDraft((draft) => ({ ...draft, companyName: nextValue }))}
                              options={taskStakeholderOptions}
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
                              <button type="button" onClick={() => { setIsAddingTask(false); setTaskEditTarget(null); setTaskDraft(null); setTaskSaveStatus(null); }} className="rounded-[10px] border border-[#444] bg-[#3c3c3c]/50 px-5 py-2 text-[14px] font-bold text-[#86868B] transition-colors hover:bg-[#3c3c3c] hover:text-white">취소</button>
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
      <div className={`fixed right-0 top-1/2 z-[70] -translate-y-1/2 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${isAiDockOpen ? 'translate-x-full' : 'translate-x-0'}`}>
          <button
            type="button"
            data-testid="logistics-ai-dock-open"
            onClick={() => setIsAiDockOpen(true)}
            className="flex h-[112px] w-11 items-center justify-center rounded-l-[16px] border border-r-0 border-[#3b82f6]/40 bg-[#1f3763] text-[13px] font-bold text-[#CFE1FF] shadow-2xl transition-[transform,opacity,background-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-[#284B87]"
            aria-label="AI 챗봇 열기"
          >
            <span className="flex flex-col items-center justify-center gap-1 leading-none">
              <span className="tracking-normal">AI</span>
              <span>챗</span>
              <span>봇</span>
            </span>
          </button>
      </div>
      <div data-testid="logistics-ai-dock" className={`fixed right-0 top-0 z-[80] flex h-screen w-[min(420px,calc(100vw-24px))] transform flex-col border-l border-[#333333] bg-[#1B1B1A] shadow-2xl transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${isAiDockOpen ? 'translate-x-0 opacity-100' : 'pointer-events-none translate-x-full opacity-0'}`}>
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
            value: formatMetric(row[item.tooltipKey || item.key], item.tooltipValueType || item.valueType || primaryValueType),
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

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

function escapeHtmlAttribute(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

function buildPrintableMapTiles(latitude, longitude, zoom = 13) {
  const lat = Math.max(-85.05112878, Math.min(85.05112878, Number(latitude)));
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];
  const tileSize = 256;
  const width = 960;
  const height = 520;
  const scale = 2 ** zoom;
  const latRad = (lat * Math.PI) / 180;
  const worldX = ((lng + 180) / 360) * scale * tileSize;
  const worldY = ((1 - Math.log(Math.tan(latRad) + (1 / Math.cos(latRad))) / Math.PI) / 2) * scale * tileSize;
  const startX = worldX - (width / 2);
  const startY = worldY - (height / 2);
  const startTileX = Math.floor(startX / tileSize);
  const endTileX = Math.floor((startX + width) / tileSize);
  const startTileY = Math.floor(startY / tileSize);
  const endTileY = Math.floor((startY + height) / tileSize);
  const maxTile = scale - 1;
  const tiles = [];
  for (let x = startTileX; x <= endTileX; x += 1) {
    for (let y = startTileY; y <= endTileY; y += 1) {
      if (y < 0 || y > maxTile) continue;
      const wrappedX = ((x % scale) + scale) % scale;
      tiles.push({
        key: `${zoom}-${wrappedX}-${y}`,
        src: `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${y}.png`,
        left: ((x * tileSize - startX) / width) * 100,
        top: ((y * tileSize - startY) / height) * 100,
        width: (tileSize / width) * 100,
        height: (tileSize / height) * 100,
      });
    }
  }
  return tiles;
}

function PortfolioMapSchematic({ points, onAssetClick = navigateToAsset }) {
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
          <button type="button" onClick={() => onAssetClick(point.assetId || point.assetName)} className="absolute left-8 top-1/2 z-10 hidden w-[230px] -translate-y-1/2 rounded-[8px] border border-[#D1D1D6] bg-white p-3 text-left text-[12px] text-[#1F1F1E] shadow-xl group-hover:block">
            <strong className="mb-1 block text-[#111]">{point.assetName}</strong>
            {point.address || '-'}
          </button>
        </div>
      ))}
    </div>
  );
}

function PortfolioMapPlot({ points, onAssetClick = navigateToAsset }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const validPoints = useMemo(() => (points || []).filter((point) => point.latitude != null && point.longitude != null), [points]);
  const [mode, setMode] = useState('loading');
  const [status, setStatus] = useState('동적 지도를 준비하고 있습니다.');

  useEffect(() => {
    const handleMapCardClick = (event) => {
      const target = event.target?.closest?.('[data-map-asset-id],[data-map-asset-name]');
      if (!target) return;
      event.preventDefault();
      event.stopPropagation();
      onAssetClick(target.getAttribute('data-map-asset-id') || target.getAttribute('data-map-asset-name'));
    };
    document.addEventListener('click', handleMapCardClick, true);
    return () => document.removeEventListener('click', handleMapCardClick, true);
  }, [onAssetClick]);

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
          marker.bindTooltip(
            `<button type="button" data-map-asset-id="${escapeHtmlAttribute(point.assetId || '')}" data-map-asset-name="${escapeHtmlAttribute(point.assetName || '')}" style="display:block;max-width:240px;border:1px solid #d1d5db;border-radius:8px;background:#fff;color:#111;padding:10px 12px;text-align:left;line-height:1.45;box-shadow:0 12px 28px rgba(0,0,0,.24);cursor:pointer;"><strong style="display:block;margin-bottom:4px;color:#111;">${escapeHtml(point.assetName || `자산 ${index + 1}`)}</strong><span style="color:#111;">${escapeHtml(point.address || '')}</span></button>`,
            { direction: 'right', offset: [14, 0], opacity: 1, sticky: true, interactive: true, className: 'logistics-map-tooltip' },
          );
          marker.on('mouseover', () => marker.openTooltip());
          marker.on('mouseout', () => window.setTimeout(() => marker.closeTooltip(), 650));
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
            content: `<button type="button" data-map-asset-id="${escapeHtmlAttribute(point.assetId || '')}" data-map-asset-name="${escapeHtmlAttribute(point.assetName || '')}" style="display:block;max-width:240px;border:1px solid #d1d5db;border-radius:8px;background:#fff;color:#111;padding:10px 12px;text-align:left;font-size:12px;line-height:1.45;box-shadow:0 12px 28px rgba(0,0,0,.24);cursor:pointer;"><strong style="display:block;margin-bottom:4px;color:#111;">${escapeHtml(point.assetName || `자산 ${index + 1}`)}</strong><span style="color:#111;">${escapeHtml(point.address || '')}</span></button>`,
          });
          let closeTimer = null;
          naver.maps.Event.addListener(marker, 'mouseover', () => {
            if (closeTimer) window.clearTimeout(closeTimer);
            infoWindow.open(map, marker);
          });
          naver.maps.Event.addListener(marker, 'mouseout', () => {
            closeTimer = window.setTimeout(() => infoWindow.close(), 650);
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
  }, [onAssetClick, validPoints]);

  if (!validPoints.length) {
    return <div className="text-[13px] text-[#86868B]">좌표가 등록된 자산이 없습니다.</div>;
  }

  return (
    <div className="space-y-3">
      <div className="relative rounded-[14px] border border-[#333333] bg-[#1F1F1E] overflow-hidden" style={{ height: 520 }}>
        <div ref={containerRef} className="logistics-map-canvas [&_img]:!max-w-none [&_*]:box-content" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} aria-label="동적 지도" />
        {mode !== 'leaflet' && mode !== 'naver' ? <PortfolioMapSchematic points={validPoints} onAssetClick={onAssetClick} /> : null}
        <div className={`absolute left-3 top-3 rounded-full border px-3 py-1 text-[12px] font-semibold ${mode === 'leaflet' || mode === 'naver' ? 'border-[#2E6B45] bg-[#173522] text-[#B5E48C]' : 'border-[#7A6425] bg-[#2B2613] text-[#FFD166]'}`}>
          {status}
        </div>
      </div>
    </div>
  );
}

function PrintableAssetMap({ point }) {
  if (!point?.latitude || !point?.longitude) {
    return (
      <div className="pdf-static-map-print rounded-[14px] border border-[#D9D9D9] bg-white p-4 text-[12px] text-[#111]">
        좌표 데이터가 없어 PDF 지도 이미지를 만들 수 없습니다.
      </div>
    );
  }
  const latitude = Number(point.latitude);
  const longitude = Number(point.longitude);
  const safeLat = Number.isFinite(latitude) ? latitude.toFixed(6) : '-';
  const safeLng = Number.isFinite(longitude) ? longitude.toFixed(6) : '-';
  const mapLabel = point.assetName || '선택 자산';
  const address = point.address || '주소 미입력';
  const tiles = buildPrintableMapTiles(latitude, longitude, 13);
  return (
    <div className="pdf-static-map-print rounded-[14px] border border-[#D9D9D9] bg-white p-3 text-[#111]">
      <div
        role="img"
        aria-label={`${mapLabel} 위치 지도`}
        className="relative w-full overflow-hidden rounded-[10px] border border-[#D9D9D9] bg-[#EEF2F6]"
        style={{ aspectRatio: '960 / 520', backgroundImage: 'linear-gradient(#D8DEE8 1px, transparent 1px), linear-gradient(90deg, #D8DEE8 1px, transparent 1px)', backgroundSize: '56px 56px' }}
      >
        {tiles.map((tile) => (
          <img
            key={tile.key}
            alt=""
            src={tile.src}
            loading="eager"
            className="absolute block select-none"
            style={{
              left: `${tile.left}%`,
              top: `${tile.top}%`,
              width: `${tile.width}%`,
              height: `${tile.height}%`,
              maxWidth: 'none',
            }}
          />
        ))}
        <div className="absolute left-1/2 top-1/2 z-10 h-9 w-9 -translate-x-1/2 -translate-y-full rounded-full border-[3px] border-white bg-[#2F80ED] shadow-[0_10px_24px_rgba(0,0,0,0.35)]">
          <div className="absolute left-1/2 top-[30px] h-4 w-4 -translate-x-1/2 rotate-45 rounded-[3px] bg-[#2F80ED]" />
          <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
        </div>
        <div className="absolute right-4 top-4 z-20 max-w-[380px] rounded-[12px] border border-[#D1D5DB] bg-white p-4 text-[#111111] shadow-[0_16px_34px_rgba(0,0,0,0.18)]">
          <div className="text-[19px] font-extrabold leading-snug text-[#111111]">{mapLabel}</div>
          <div className="mt-2 text-[13px] leading-5 text-[#111111]">{address}</div>
          <div className="mt-2 text-[12px] text-[#4B5563]">위도 {safeLat} · 경도 {safeLng}</div>
        </div>
        <div className="absolute bottom-2 right-3 z-20 rounded bg-white/90 px-2 py-1 text-[10px] font-semibold text-[#4B5563]">
          Map data © OpenStreetMap contributors
        </div>
        {!tiles.length ? (
          <div className="absolute inset-0 flex items-center justify-center text-[13px] font-semibold text-[#4B5563]">
            지도 타일을 만들 수 없어 좌표 위치만 표시합니다.
          </div>
        ) : null}
      </div>
      <div className="mt-2 text-[11px] leading-4 text-[#3A3A3C]">
        PDF 저장용 지도입니다. 좌표와 주소를 기준으로 실제 지도 타일과 자산 위치를 함께 출력합니다.
      </div>
    </div>
  );
}

function normalizeHomeData(home) {
  const kpiMap = kpiLookupFrom(home.kpis);
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
  const permission = useMemo(() => resolveLogisticsPermission(memberInfo), [memberInfo]);
  const staticHomeData = useMemo(() => normalizeHomeData(homeData), []);
  const staticGeneralRows = useMemo(() => buildLogisticsGeneralRows(), []);
  const homeReadAdapter = useMemo(() => (
    (response) => homePayloadFromDashboardRead(response, homeData, staticGeneralRows)
  ), [staticGeneralRows]);
  const homeRead = useDashboardReadBridge('dashboard/home/read', { basis_date: DASHBOARD_BASIS_DATE }, {
    operating_asset_count: staticHomeData.operatingAssetCount,
    leased_area_sqm: staticHomeData.leasedArea,
    current_monthly_cost_total: staticHomeData.monthlyCost,
  }, homeReadAdapter, Boolean(memberInfo));
  const homeReadBlocked = homeRead.primaryMode && !homeRead.fallbackAllowed && !homeRead.payload;
  const home = useMemo(() => (
    homeRead.payload || (homeReadBlocked ? {
      kpis: [],
      mapPoints: [],
      vacancySummary: [],
      topContracts: [],
      topTenants: [],
      monthlyExpiryRows: [],
      contractSummary: [],
      rentTrend: [],
      costCompositionByAsset: [],
      costCompositionByTenant: [],
      usageComposition: [],
      regionExposure: [],
      vacancySummaryRows: [],
    } : homeData)
  ), [homeRead.payload, homeReadBlocked]);
  const data = useMemo(() => normalizeHomeData(home), [home]);
  const [modal, setModal] = useState(null);
  const [costCompositionMode, setCostCompositionMode] = useState('asset');
  const [compositionAssetId, setCompositionAssetId] = useState('all');
  const [sectorAssetSort, setSectorAssetSort] = useState('cost');
  const [sectorTenantSort, setSectorTenantSort] = useState('cost');
  const [regionMetric, setRegionMetric] = useState('cost');
  const allGeneralRows = useMemo(() => (homeReadBlocked ? [] : home.__supabaseGeneralRows || staticGeneralRows), [home, homeReadBlocked, staticGeneralRows]);
  const generalRows = useMemo(() => filterAssetsByPermission(allGeneralRows, permission), [allGeneralRows, permission]);
  const homeAssetOptions = useMemo(() => (
    homeReadBlocked ? [] : home.__supabaseAssetOptions || assetOptionsData
  ), [home.__supabaseAssetOptions, homeReadBlocked]);
  const readableAssetOptions = useMemo(() => filterAssetsByPermission(homeAssetOptions, permission), [homeAssetOptions, permission]);
  const readableVacancyRows = useMemo(() => filterAssetsByPermission(data.vacancyRows, permission), [data.vacancyRows, permission]);
  const readableMapPoints = useMemo(() => filterAssetsByPermission(data.mapPoints, permission), [data.mapPoints, permission]);
  const assetSnapshotMonthlyCost = sumRows(readableAssetOptions, (row) => row.monthlyCostTotal);
  const leaseSpaceMonthlyCost = sumRows(generalRows, (row) => row.monthlyCostTotal);
  const canonicalMonthlyCost = Number(assetSnapshotMonthlyCost || data.monthlyCost || leaseSpaceMonthlyCost || 0);
  const rawRentTrendRows = home.rentTrend || [];
  const maxRentTrendGrossArea = Math.max(...rawRentTrendRows.map((row) => Number(row.grossFloorAreaSqm || 0)), 1);
  const maxRentTrendAssetCount = Math.max(...rawRentTrendRows.map((row) => Number(row.activeAssetCount || 0)), 1);

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
      activeAssetCountPlot: maxRentTrendAssetCount > 0 ? (Number(firstDefined(row.activeAssetCount, 0)) / maxRentTrendAssetCount) * maxRentTrendGrossArea : 0,
      grossFloorAreaDisplay: row.grossFloorAreaDisplay ?? (row.grossFloorAreaSqm != null ? Number(row.grossFloorAreaSqm) / 10000 : null),
    };
  });
  const latestRentTrendRow = rentTrendRows.at(-1) || {};
  const latestTrendMonthlyCost = Number(latestRentTrendRow.monthlyCostTotalAdjusted || 0);
  const trendToKpiGap = canonicalMonthlyCost && latestTrendMonthlyCost ? canonicalMonthlyCost - latestTrendMonthlyCost : 0;
  const leaseSpaceToKpiGap = canonicalMonthlyCost && leaseSpaceMonthlyCost ? canonicalMonthlyCost - leaseSpaceMonthlyCost : 0;
  const mapAssetRows = readableMapPoints.map((point) => {
    const vacancy = readableVacancyRows.find((row) => row.assetId === point.assetId || row.assetName === point.assetName) || {};
    return {
      ...point,
      ...vacancy,
      address: firstDefined(point.address, vacancy.address),
      grossFloorAreaSqm: firstDefined(point.grossFloorAreaSqm, vacancy.grossFloorAreaSqm),
    };
  });
  const portfolioRows = mapAssetRows.map((row, index) => ({
    ...(() => {
      const option = readableAssetOptions.find((item) => item.assetId === row.assetId || normalizeAssetNameKey(item.assetName) === normalizeAssetNameKey(row.assetName)) || {};
      const assetRows = generalRows.filter((item) => item.assetId === row.assetId || normalizeAssetNameKey(item.assetName) === normalizeAssetNameKey(row.assetName));
      const useRows = buildUseCategoryRows({ rows: assetRows, overview: { ...option, ...row } }, option, {});
      const coldArea = Number(useRows.find((item) => item.label === '저온창고')?.value || 0);
      const ambientArea = Number(useRows.find((item) => item.label === '상온창고')?.value || 0);
      const weightedENoc = calculateWeightedENoc(assetRows, option.averageENoc);
      const coldRatio = Number(coldArea || 0) + Number(ambientArea || 0) > 0
        ? formatPercent(Number(coldArea || 0) / (Number(coldArea || 0) + Number(ambientArea || 0)))
        : cleanDisplay(option.coldRatio, '-');
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
  const metricAssetRows = readableAssetOptions.map((asset) => {
    const sourceGrossAreaSqm = Number(asset.grossFloorAreaSqm || 0);
    const leasedAreaSqm = Number(asset.leasedAreaSqm || 0);
    const explicitVacancyAreaSqm = firstDefined(asset.vacancyAreaSqm, asset.vacancy_area_sqm);
    const vacancyAreaSqm = explicitVacancyAreaSqm !== undefined && explicitVacancyAreaSqm !== null && explicitVacancyAreaSqm !== ''
      ? Number(explicitVacancyAreaSqm || 0)
      : Math.max(0, sourceGrossAreaSqm - leasedAreaSqm);
    const areaReconciliationGapSqm = sourceGrossAreaSqm - leasedAreaSqm - vacancyAreaSqm;
    return {
      ...asset,
      grossFloorAreaSqm: sourceGrossAreaSqm,
      leasedAreaSqm,
      vacancyAreaSqm,
      areaReconciliationGapSqm,
      vacancyRate: sourceGrossAreaSqm > 0 ? vacancyAreaSqm / sourceGrossAreaSqm : 0,
    };
  });
  const filteredHomeMetrics = {
    operatingAssetCount: metricAssetRows.length || readableMapPoints.length || mapAssetRows.length,
    grossArea: sumRows(metricAssetRows, (row) => row.grossFloorAreaSqm),
    leasedArea: sumRows(metricAssetRows, (row) => row.leasedAreaSqm),
    vacancyArea: sumRows(metricAssetRows, (row) => row.vacancyAreaSqm),
  };
  filteredHomeMetrics.vacancyRate = filteredHomeMetrics.grossArea > 0 ? filteredHomeMetrics.vacancyArea / filteredHomeMetrics.grossArea : data.vacancyRate;
  filteredHomeMetrics.areaReconciliationGap = filteredHomeMetrics.grossArea - filteredHomeMetrics.leasedArea - filteredHomeMetrics.vacancyArea;

  const openTableModal = (title, headers, rows, options = {}) => setModal({ title, headers, rows, ...options });
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
    ['운영 자산 수', formatMetric(filteredHomeMetrics.operatingAssetCount, 'number'), DASHBOARD_BASIS_LABEL, () => openTableModal('운영 자산 목록', ['자산명', '주소', '연면적(평)', '임대면적(평)', '공실면적(평)', '차이', '공실률'], metricAssetRows.map((row) => [row.assetName, row.address || '-', formatArea(row.grossFloorAreaSqm), formatArea(row.leasedAreaSqm), formatArea(row.vacancyAreaSqm), formatSignedArea(row.areaReconciliationGapSqm), formatPercent(row.vacancyRate)]))],
    ['총 연면적', formatMetric(filteredHomeMetrics.grossArea, 'area'), DASHBOARD_BASIS_LABEL, () => openTableModal('총 연면적 근거', ['자산명', '연면적(평)', '임대면적(평)', '공실면적(평)', '차이'], metricAssetRows.map((row) => [row.assetName, formatArea(row.grossFloorAreaSqm), formatArea(row.leasedAreaSqm), formatArea(row.vacancyAreaSqm), formatSignedArea(row.areaReconciliationGapSqm)]))],
    ['총 임대면적', formatMetric(filteredHomeMetrics.leasedArea, 'area'), DASHBOARD_BASIS_LABEL, () => openTableModal('총 임대면적 근거', ['자산명', '연면적(평)', '임대면적(평)', '공실면적(평)', '차이'], metricAssetRows.map((row) => [row.assetName, formatArea(row.grossFloorAreaSqm), formatArea(row.leasedAreaSqm), formatArea(row.vacancyAreaSqm), formatSignedArea(row.areaReconciliationGapSqm)]))],
    ['총 공실면적', formatMetric(filteredHomeMetrics.vacancyArea, 'area'), DASHBOARD_BASIS_LABEL, () => openTableModal('총 공실면적 근거', ['자산명', '연면적(평)', '임대면적(평)', '공실면적(평)', '차이'], metricAssetRows.map((row) => [row.assetName, formatArea(row.grossFloorAreaSqm), formatArea(row.leasedAreaSqm), formatArea(row.vacancyAreaSqm), formatSignedArea(row.areaReconciliationGapSqm)]))],
    ['공실률', formatMetric(filteredHomeMetrics.vacancyRate, 'percent'), DASHBOARD_BASIS_LABEL, () => openTableModal('공실률 계산 근거', ['항목', '내용'], [['기준시점', DASHBOARD_BASIS_LABEL], ['총 연면적(평)', formatArea(filteredHomeMetrics.grossArea)], ['총 임대면적(평)', formatArea(filteredHomeMetrics.leasedArea)], ['총 공실면적(평)', formatArea(filteredHomeMetrics.vacancyArea)], ['연면적-임대면적-공실면적 차이', formatSignedArea(filteredHomeMetrics.areaReconciliationGap)], ['계산식', '총 공실면적 / 총 연면적'], ['공실률', formatPercent(filteredHomeMetrics.vacancyRate)]])],
    ['월 임관리비 총액', formatMetric(canonicalMonthlyCost, 'currency'), `${DASHBOARD_BASIS_LABEL} · Rent History 기준`, () => openTableModal('월 임관리비 총액 근거', ['구분', '값', '비고'], [['기준시점', DASHBOARD_BASIS_LABEL, '기준월 이전 최신 rent history를 계약 구역별로 반영'], ['자산 합계', formatCurrency(assetSnapshotMonthlyCost), 'KPI/자산별 도넛 기준'], ['Lease space 합계', formatCurrency(leaseSpaceMonthlyCost), '임차인 계약 row 기준'], ['차이', formatCurrency(leaseSpaceToKpiGap), 'Data Quality reconciliation 대상'], ...monthlyCostEvidenceRows.map((row) => [row.tenantMasterName, formatCurrency(row.value), `${formatNumber(row.assetCount)}개 자산 · 최근 만기 ${formatDate(row.latestExpiry)}`])])],
  ];
  const composition = home.composition || {};
  const selectedCompositionOption = compositionAssetId === 'all' ? null : readableAssetOptions.find((item) => item.assetId === compositionAssetId);
  const selectedCompositionRows = selectedCompositionOption
    ? generalRows.filter((row) => row.assetId === selectedCompositionOption.assetId || normalizeAssetNameKey(row.assetName) === normalizeAssetNameKey(selectedCompositionOption.assetName))
    : [];
  const portfolioUseCategoryRows = mergeUseCategoryRows(readableAssetOptions.map((asset) => {
    const assetRows = generalRows.filter((row) => row.assetId === asset.assetId || normalizeAssetNameKey(row.assetName) === normalizeAssetNameKey(asset.assetName));
    return buildUseCategoryRows({ rows: assetRows, overview: asset }, asset, {});
  }));
  const coldStorageRows = selectedCompositionOption
    ? buildUseCategoryRows({ rows: selectedCompositionRows, overview: selectedCompositionOption }, selectedCompositionOption || {}, {})
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
    monthlyCostCompositionLimit(costCompositionMode),
    costCompositionMode === 'asset' ? '기타 자산' : '기타/미분류 임차인',
  );
  const monthlyCostCompositionTotal = sumRows(monthlyCostSourceRows, (row) => row.value) || canonicalMonthlyCost;
  const monthlyCostCompositionTitle = costCompositionMode === 'asset' ? '자산별 월 임관리비 비중' : '임차인별 월 임관리비 비중';
  const sectorTopAssetsSource = readableAssetOptions.map((asset) => ({
    ...asset,
    monthlyRentTotal: sumRows(generalRows.filter((row) => row.assetId === asset.assetId), (row) => firstDefined(row.currentMonthlyRentTotal, row.monthlyRentTotal)),
    monthlyMfTotal: sumRows(generalRows.filter((row) => row.assetId === asset.assetId), (row) => firstDefined(row.currentMonthlyMfTotal, row.monthlyMfTotal)),
    monthlyCostTotal: sumRows(generalRows.filter((row) => row.assetId === asset.assetId), (row) => firstDefined(row.monthlyCostTotal, row.monthlyCombinedTotal)),
    leasedAreaSqm: sumRows(generalRows.filter((row) => row.assetId === asset.assetId), (row) => row.leasedAreaSqm),
  }));
  const sectorTopTenantsSource = tenantContractGroups;
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
  const regionAreaTotal = regionRows.reduce((sum, row) => sum + Number(row.grossFloorAreaSqm || 0), 0);
  const regionCostTotal = regionRows.reduce((sum, row) => sum + Number(row.monthlyCostTotal || 0), 0);
  const regionExposureRows = regionRows.map((row) => [
    row.label,
    formatNumber(row.assetCount),
    formatArea(row.grossFloorAreaSqm),
    formatPercent(regionAreaTotal ? Number(row.grossFloorAreaSqm || 0) / regionAreaTotal : 0),
    formatCurrency(row.monthlyCostTotal),
    formatPercent(regionCostTotal ? Number(row.monthlyCostTotal || 0) / regionCostTotal : 0),
  ]);
  const regionChartRows = regionRows.map((row) => ({
    ...row,
    value: regionMetric === 'area'
      ? (regionAreaTotal ? Number(row.grossFloorAreaSqm || 0) / regionAreaTotal : 0)
      : (regionCostTotal ? Number(row.monthlyCostTotal || 0) / regionCostTotal : 0),
    displayValue: regionMetric === 'area'
      ? `${formatArea(row.grossFloorAreaSqm)} (${formatPercent(regionAreaTotal ? Number(row.grossFloorAreaSqm || 0) / regionAreaTotal : 0)})`
      : `${formatCurrency(row.monthlyCostTotal)} (${formatPercent(regionCostTotal ? Number(row.monthlyCostTotal || 0) / regionCostTotal : 0)})`,
    tooltipLines: [
      ['연면적 비율', formatPercent(regionAreaTotal ? Number(row.grossFloorAreaSqm || 0) / regionAreaTotal : 0)],
      ['월 임관리비 비율', formatPercent(regionCostTotal ? Number(row.monthlyCostTotal || 0) / regionCostTotal : 0)],
    ],
  }));

  return (
    <div className="space-y-6">
      <LogisticsModal modal={modal} onClose={() => setModal(null)} />
      {homeRead.blocked ? (
        <DashboardAccessState title="Dashboard read blocked" message="Supabase read API가 현재 로그인 사용자의 Home 데이터 읽기 권한을 허용하지 않아 정적 JSON fallback을 차단했습니다." />
      ) : null}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {kpiCards.map(([label, value, basis, action]) => (
          <button key={label} type="button" onClick={action} className="min-w-0 text-left rounded-[14px] border border-[#333333] bg-[#252524] px-3 py-3 hover:bg-[#2A2A29]">
            <div className="text-[12px] text-[#86868B] font-semibold">{label}</div>
            <div className="mt-2 truncate text-[20px] font-semibold text-white" title={String(value)}>{value}</div>
            <div className="mt-1 text-[11px] font-medium text-[#86868B]">{basis}</div>
          </button>
        ))}
      </section>

      <section className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
        <SectionHeader
          eyebrow="LOCATION"
          title="포트폴리오 위치"
          right={<button type="button" onClick={() => openTableModal('포트폴리오 자산 목록', ['No.', '자산명', '주소(시군구)', '연면적(평)', '저온창고 비율', 'E. NOC'], portfolioModalRows)} className="h-9 px-3 rounded-[8px] bg-[#30302F] text-white text-[13px] font-semibold hover:bg-[#3A3A3A]">자산 표</button>}
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
          <DoughnutBreakdownChart rows={monthlyCostCompositionRows} valueType="currency" title={monthlyCostCompositionTitle} maxRows={monthlyCostCompositionLimit(costCompositionMode)} onClick={() => openTableModal(monthlyCostCompositionTitle, [costCompositionMode === 'asset' ? '자산명' : '임차인명', '비중', '월 임관리비', costCompositionMode === 'asset' ? '임차인 수' : '자산 수'], monthlyCostSourceRows.map((row) => [row.label, formatPercent(Number(row.value || 0) / Math.max(monthlyCostCompositionTotal, 1)), formatCurrency(row.value), `${formatNumber(row.recordCount)}개`]))} onSegmentClick={(row) => openTableModal(`${monthlyCostCompositionTitle} · ${row.label}`, ['항목', '내용'], [[costCompositionMode === 'asset' ? '자산명' : '임차인명', row.label], ['비중', formatPercent(Number(row.value || 0) / Math.max(monthlyCostCompositionTotal, 1))], ['월 임관리비', formatCurrency(row.value)], [costCompositionMode === 'asset' ? '임차인 수' : '자산 수', `${formatNumber(row.recordCount)}개`]])} />
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
          rightValueType="area"
          rightAxisColor="#A78BFA"
          onClick={() => openTableModal('임대료 추이 원본 표', ['월', '월 임대료(RF/FO 반영)', '월 관리비', '월 임관리비(RF/FO 반영)', '월 임대료', '월 관리비', '월 임관리비', '자산 수', '총 연면적(평)', '신규 편입 자산'], rentTrendRows.map((row) => [row.month, formatCurrency(row.monthlyRentTotalAdjusted), formatCurrency(row.monthlyMfTotalAdjusted), formatCurrency(row.monthlyCostTotalAdjusted), formatCurrency(row.monthlyRentTotal), formatCurrency(row.monthlyMfTotal), formatCurrency(row.monthlyTotal), formatNumber(row.activeAssetCount), formatArea(row.grossFloorAreaSqm), formatNewlyAddedAssets(row)]))}
          extraTooltipRows={(row) => [
            {
              label: '자산 수',
              value: formatMetric(row.activeAssetCount, 'count'),
            },
            {
              label: '신규 편입 자산',
              value: formatNewlyAddedAssets(row),
            },
          ]}
          series={[
            { key: 'monthlyRentTotalAdjusted', label: '월 임대료(RF/FO 반영)', valueType: 'currency' },
            { key: 'monthlyMfTotalAdjusted', label: '월 관리비', valueType: 'currency' },
            { key: 'monthlyCostTotalAdjusted', label: '월 임관리비(RF/FO 반영)', valueType: 'currency' },
            { key: 'grossFloorAreaSqm', label: '보유 연면적', valueType: 'area', axis: 'right', chartType: 'bar', color: '#A78BFA' },
            { key: 'activeAssetCountPlot', label: '자산 수', valueType: 'area', tooltipKey: 'activeAssetCount', tooltipValueType: 'count', axis: 'right', chartType: 'line', color: '#C7A6FF' },
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
                <button type="button" onClick={() => openTableModal('권역별 노출도', ['권역', '자산 수', '연면적(평)', '연면적 비율', '월 임관리비', '임관리비 비율'], regionExposureRows)} className="h-9 px-3 rounded-[8px] bg-[#30302F] text-white text-[13px] font-semibold hover:bg-[#3A3A3A]">상세</button>
              </div>
            )}
          />
          <RichBarChart rows={regionChartRows} labelKey="label" valueKey="value" valueType="percent" valueLabel={regionMetric === 'area' ? '권역별 연면적 비율' : '권역별 월 임관리비 비율'} barMaxValue={1} showXAxisLabels={false} onClick={() => openTableModal('권역별 노출도', ['권역', '자산 수', '연면적(평)', '연면적 비율', '월 임관리비', '임관리비 비율'], regionExposureRows)} />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5">
        <div className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
          <SectionHeader
            eyebrow="EXPIRY"
            title="만기 집중도"
            right={<button type="button" onClick={() => openTableModal('만기 집중도 월별 상세', ['만기월', '임차인', '자산', '임대면적(평)', '월 임대료', '월 관리비', '월 임관리비', '평당 월 임대료', '평당 월 관리비', 'E.NOC', '공간'], expiryDetailRows, { size: 'fullscreen' })} className="h-9 px-3 rounded-[8px] bg-[#30302F] text-white text-[13px] font-semibold hover:bg-[#3A3A3A]">월별 상세 보기</button>}
          />
          <RichTrendChart
            rows={data.monthlyExpiryRows}
            labelKey="month"
            leftValueType="area"
            rightValueType="count"
            rightAxisColor="#FFD166"
            chartHeight={460}
            chartHeightClass="h-[440px]"
            onClick={() => openTableModal('만기 집중도 월별 상세', ['만기월', '임차인', '자산', '임대면적(평)', '월 임대료', '월 관리비', '월 임관리비', '평당 월 임대료', '평당 월 관리비', 'E.NOC', '공간'], expiryDetailRows, { size: 'fullscreen' })}
            series={[
              { key: 'expiringAreaSqm', label: '만기 임대면적', valueType: 'area', chartType: 'bar', color: '#9AD7FF' },
              { key: 'uniqueTenantCount', label: '만기 임차인 수', valueType: 'count', axis: 'right', color: '#FFD166' },
            ]}
          />
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

function RichBarChart({
  rows,
  labelKey,
  valueKey,
  valueType = 'number',
  onClick,
  valueLabel,
  maxRows = 10,
  includeZero = false,
  showXAxisLabels = true,
  barValueKey = null,
  barMaxValue = null,
}) {
  const chartRef = useRef(null);
  const [hoveredBar, setHoveredBar] = useState(null);
  const filteredRows = (rows || []).filter((row) => {
    const value = Number(row?.[valueKey]);
    return Number.isFinite(value) && (includeZero ? value >= 0 : value > 0);
  });
  const chartRows = Number.isFinite(maxRows) ? filteredRows.slice(0, maxRows) : filteredRows;
  const axisValueKey = barValueKey || valueKey;
  const maxValue = Number.isFinite(barMaxValue)
    ? Math.max(Number(barMaxValue), 1)
    : buildAxisSpec(Math.max(...chartRows.map((row) => Number(row[axisValueKey] || 0)), 1), valueType).max;
  const metricName = valueLabel || chartMetricLabel(valueKey, valueType);
  if (!chartRows.length) return <div className="text-[13px] text-[#86868B]">차트로 표시할 값이 없습니다.</div>;
  return (
    <div ref={chartRef} onMouseLeave={() => setHoveredBar(null)} className="relative rounded-[14px] border border-[#333333] bg-[#1F1F1E] p-4">
      {showXAxisLabels ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-[12px]">
          <span className="text-[#86868B]">Y축: 항목 · X축: {metricName}</span>
          <span className="text-[#D1D1D6]"><span className="mr-1 inline-block h-2 w-6 rounded-full bg-[#9AD7FF]" />막대 길이 = {metricName}</span>
        </div>
      ) : null}
      <div className="space-y-3">
        {chartRows.map((row) => {
          const value = Number(row[valueKey] || 0);
          const barValue = Number(row[axisValueKey] || 0);
          const label = chartLabel(row, labelKey);
          return (
            <button
              key={`${label}-${valueKey}`}
              type="button"
              onClick={onClick}
              onMouseEnter={(event) => setHoveredBar({ row, label, value, barValue, ...getTooltipPoint(event, chartRef.current, 240, 150) })}
              onMouseMove={(event) => setHoveredBar({ row, label, value, barValue, ...getTooltipPoint(event, chartRef.current, 240, 150) })}
              onFocus={() => setHoveredBar({ row, label, value, barValue, x: 220, y: 72 })}
              onBlur={() => setHoveredBar(null)}
              aria-label={`${label} ${metricName} ${formatMetric(value, valueType)}`}
              className="group relative w-full cursor-pointer rounded-[10px] px-2 py-1.5 text-left hover:bg-[#282827]"
            >
              <span className="sr-only">{metricName}</span>
              <div className="grid grid-cols-[168px_1fr_152px] items-center gap-3 text-[12px]">
                <span className="truncate font-semibold text-[#E5E5E5]">{label}</span>
                <div className="relative h-5 rounded-full bg-[#151515]">
                  <div className="h-full rounded-full bg-[#9AD7FF] transition-colors group-hover:bg-[#B5E48C]" style={{ width: `${Math.min(100, Math.max(3, (barValue / maxValue) * 100))}%` }} />
                </div>
                <span className="text-right font-semibold text-[#D1D1D6]">{row.displayValue || formatMetric(value, valueType)}</span>
              </div>
            </button>
          );
        })}
      </div>
      {showXAxisLabels ? (
        <div className="mt-3 grid grid-cols-5 border-t border-[#333333] pt-2 text-[11px] text-[#86868B]">
          {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
            <span key={tick} className={tick === 1 ? 'text-right' : tick === 0 ? 'text-left' : 'text-center'}>
              {shortChartValue(maxValue * tick, valueType)}
            </span>
          ))}
        </div>
      ) : null}
      {hoveredBar ? (
        <div data-testid="chart-tooltip" className="pointer-events-none fixed z-50 w-[240px] rounded-[8px] border border-[#3A3A3C] bg-[#101010]/95 px-3 py-2 text-[12px] text-white shadow-xl" style={{ left: hoveredBar.x, top: hoveredBar.y }}>
          <div className="font-semibold">{hoveredBar.label}</div>
          <div className="mt-1 text-[#A1A1AA]">{metricName}: {hoveredBar.row.displayValue || formatMetric(hoveredBar.value, valueType)}</div>
          <div className="text-[#86868B]">전체 최대값 대비 {((Number(hoveredBar.barValue || 0) / maxValue) * 100).toFixed(1)}%</div>
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

function DoughnutBreakdownChart({ rows, valueType = 'number', title, onClick, onSegmentClick, maxRows = 8 }) {
  const [hoveredSegment, setHoveredSegment] = useState(null);
  const chartRef = useRef(null);
  const svgRef = useRef(null);
  const sourceRows = (rows || []).filter((row) => Number(row.value || 0) > 0).slice(0, maxRows);
  const chartRows = sourceRows.slice(0, maxRows);
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
  const rows = (floors || []).slice().sort((a, b) => floorSortValue(b.floorLabel) - floorSortValue(a.floorLabel));
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
                title={`${tenant.tenantMasterName || '-'}${tenant.detailAreaLabel ? ` · ${tenant.detailAreaLabel}` : ''} · ${formatArea(tenant.leasedAreaSqm)}`}
              >
                <div className="truncate font-semibold">{tenant.tenantMasterName || '-'}</div>
                <div className="truncate text-[#B8DFFF]">{[tenant.detailAreaLabel, formatArea(tenant.leasedAreaSqm)].filter(Boolean).join(' · ')}</div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function floorSortValue(label) {
  const value = String(label || '').trim().toUpperCase();
  const matches = [...value.matchAll(/B\s*\d+|\d+(?:\.\d+)?\s*(?:F|층)?/giu)];
  if (matches.length) {
    const floorValues = matches.map((match) => {
      const token = match[0].trim().toUpperCase();
      const numeric = Number((token.match(/\d+(?:\.\d+)?/u) || [])[0]);
      if (!Number.isFinite(numeric)) return -999;
      return token.startsWith('B') ? -numeric : numeric;
    });
    return Math.max(...floorValues);
  }
  const basement = value.match(/^B\s*(\d+)/u);
  if (basement) return -Number(basement[1]);
  const numeric = value.match(/-?\d+(?:\.\d+)?/u);
  return numeric ? Number(numeric[0]) : -999;
}

function expiryDateForRow(row = {}) {
  return firstDefined(row.currentEndDate, row.latestExpiry, row.earliestExpiry, row.endDate, row.firstEndDate, row.contractEndDate);
}

function expiryFloorSortValue(row = {}) {
  return floorSortValue(firstDefined(row.floorLabel, row.spaceLabel, row.detailAreaLabel, row.sourceFloorLabel));
}

function expiryRowKey(row = {}, index = 0) {
  return String(firstDefined(
    row.leaseSpaceId,
    row.lease_space_id,
    row.sourceSheetRowId,
    row.source_sheet_row_id,
    [row.tenantMasterName, row.spaceLabel, row.floorLabel, row.detailAreaLabel, expiryDateForRow(row), index].filter(Boolean).join('|'),
  ));
}

function sortExpiryRows(rows = []) {
  return (rows || []).slice().sort((a, b) => {
    const aMonths = Number(firstDefined(a.monthsToExpiry, monthsUntil(expiryDateForRow(a)), Number.POSITIVE_INFINITY));
    const bMonths = Number(firstDefined(b.monthsToExpiry, monthsUntil(expiryDateForRow(b)), Number.POSITIVE_INFINITY));
    if (Number.isFinite(aMonths) && Number.isFinite(bMonths) && aMonths !== bMonths) return aMonths - bMonths;
    if (Number.isFinite(aMonths) !== Number.isFinite(bMonths)) return Number.isFinite(aMonths) ? -1 : 1;

    const floorDiff = expiryFloorSortValue(b) - expiryFloorSortValue(a);
    if (floorDiff) return floorDiff;

    const aDate = String(expiryDateForRow(a) || '');
    const bDate = String(expiryDateForRow(b) || '');
    if (aDate !== bDate) return aDate.localeCompare(bDate);

    return String(firstDefined(a.tenantMasterName, a.spaceLabel, a.leaseSpaceId, '') || '')
      .localeCompare(String(firstDefined(b.tenantMasterName, b.spaceLabel, b.leaseSpaceId, '') || ''), 'ko-KR');
  });
}

function buildStackingFloorsFromRows(rows = [], fallbackFloors = []) {
  const grouped = new Map();
  (rows || []).forEach((row) => {
    const floorLabel = cleanDisplay(row.floorLabel || String(row.spaceLabel || '').split(/\s+/u)[0], '');
    if (!floorLabel) return;
    const leasedAreaSqm = Number(row.leasedAreaSqm || 0);
    const key = floorLabel.toUpperCase();
    if (!grouped.has(key)) grouped.set(key, { floorLabel, totalLeasedAreaSqm: 0, tenants: [] });
    const group = grouped.get(key);
    const tenantDisplayName = firstHumanTenantName(row.tenantMasterName, row.tenantName, row.companyName);
    group.totalLeasedAreaSqm += Number.isFinite(leasedAreaSqm) ? leasedAreaSqm : 0;
    group.tenants.push({
      ...row,
      tenantMasterName: tenantDisplayName || '-',
      detailAreaLabel: cleanDisplay(row.detailAreaLabel, ''),
      leasedAreaSqm,
      monthlyCostTotal: firstDefined(row.monthlyCostTotal, row.monthlyCombinedTotal, row.currentMonthlyCostTotal),
    });
  });
  if (grouped.size) {
    return [...grouped.values()].map((floor) => ({
      ...floor,
      tenants: floor.tenants.map((tenant) => ({
        ...tenant,
        share: floor.totalLeasedAreaSqm > 0 ? Number(tenant.leasedAreaSqm || 0) / floor.totalLeasedAreaSqm : 1 / floor.tenants.length,
      })),
    }));
  }
  return (fallbackFloors || []).map((floor) => {
    const floorArea = Number(floor.leasedAreaSqm || 0);
    const tenants = (floor.tenants || []).map((tenant, index, tenantRows) => (
      typeof tenant === 'string'
        ? {
            tenantMasterName: tenant,
            leasedAreaSqm: floorArea,
            monthlyCostTotal: floor.monthlyCostTotal,
            share: tenantRows.length ? 1 / tenantRows.length : 1,
          }
        : {
            ...tenant,
            tenantMasterName: firstHumanTenantName(tenant.tenantMasterName, tenant.tenantName, tenant.companyName) || '-',
            leasedAreaSqm: firstDefined(tenant.leasedAreaSqm, floorArea),
            monthlyCostTotal: firstDefined(tenant.monthlyCostTotal, floor.monthlyCostTotal),
            share: firstDefined(tenant.share, tenantRows.length ? 1 / tenantRows.length : 1),
          }
    ));
    return { ...floor, tenants };
  });
}

function buildExpiryRowsFromRows(rows = []) {
  return sortExpiryRows((rows || [])
    .map((row) => {
      const expiryDate = expiryDateForRow(row);
      const months = monthsUntil(expiryDate);
      if (months == null) return null;
      return {
        ...row,
        currentEndDate: expiryDate,
        monthsToExpiry: firstDefined(row.monthsToExpiry, months),
        monthlyCostTotal: firstDefined(row.monthlyCostTotal, row.monthlyCombinedTotal, row.currentMonthlyCostTotal),
      };
    })
    .filter(Boolean));
}

function mergeExpiryRows(derivedRows = [], explicitRows = []) {
  const merged = new Map();
  derivedRows.forEach((row, index) => merged.set(expiryRowKey(row, index), row));
  explicitRows.forEach((row, index) => {
    const key = expiryRowKey(row, index);
    const derived = merged.get(key);
    if (derived) {
      merged.set(key, {
        ...row,
        ...derived,
        monthsToExpiry: firstDefined(derived.monthsToExpiry, row.monthsToExpiry),
        monthlyCostTotal: firstDefined(derived.monthlyCostTotal, derived.monthlyCombinedTotal, row.monthlyCostTotal, row.monthlyCombinedTotal, row.currentMonthlyCostTotal),
      });
      return;
    }
    merged.set(key, row);
  });
  return sortExpiryRows([...merged.values()]);
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
    const tenantDisplayName = firstHumanTenantName(row.tenantMasterName, row.tenantName, row.companyName, row.tenantLabel);
    return {
      ...row,
      tenantMasterName: tenantDisplayName || '-',
      companyName: firstHumanTenantName(row.companyName, row.tenantMasterName, row.tenantName, row.tenantLabel) || tenantDisplayName || '-',
      leasedAreaSqm,
      monthlyRentTotal,
      monthlyMfTotal,
      monthlyCombinedTotal,
      currentRentPerPy: firstDefined(row.currentRentPerPy, rent.rentPerPy),
      currentMfPerPy: firstDefined(row.currentMfPerPy, rent.mfPerPy),
      currentStartDate: firstDefined(row.currentStartDate, row.startDate, row.latestStartDate),
      currentEndDate: firstDefined(row.currentEndDate, expiry.currentEndDate, row.endDate, row.latestExpiry, row.firstEndDate, row.contractEndDate),
      spaceLabel: [row.floorLabel, row.detailAreaLabel].filter(Boolean).join(' / ') || '-',
      eNoc: derivedENoc,
    };
  });
  const corrected = applyAssetDisplayCorrections(payload, rows);
  const explicitExpiryRows = payload.analytics?.expirySnapshot?.entries?.length
    ? payload.analytics.expirySnapshot.entries
    : payload.analytics?.contractExpiry?.length
      ? payload.analytics.contractExpiry
      : [];
  const derivedExpiryRows = buildExpiryRowsFromRows(corrected.rows.length ? corrected.rows : explicitExpiryRows);
  const mergedExpiryRows = mergeExpiryRows(derivedExpiryRows, explicitExpiryRows);
  return {
    ...payload,
    overview: corrected.overview,
    kpis: corrected.kpis,
    normalizedRows: corrected.rows,
    uniqueTenants: payload.analytics?.uniqueTenants || payload.topTenants || [],
    monthlyCostByTenant: payload.analytics?.monthlyCostByTenant || payload.analytics?.coreTenants || [],
    expiryRows: mergedExpiryRows,
  };
}

function buildSpaceLabel(row) {
  const floors = Array.isArray(row.floorLabels) ? row.floorLabels.join(', ') : row.floorLabel;
  const details = Array.isArray(row.detailAreaLabels) ? row.detailAreaLabels.join(', ') : row.detailAreaLabel;
  return [floors, details].filter(Boolean).join(' / ') || '-';
}

function formatFloorZoneLabel(value) {
  const text = String(value || '').trim();
  if (!text || text === '-') return '-';
  if (/^\d+$/u.test(text)) return `${text}층`;
  if (/^B\d+$/iu.test(text)) return `${text.toUpperCase()}층`;
  if (/층|F/iu.test(text)) return text;
  return text;
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
    kpis: normalizeKpiList(payload.kpis),
  };
}

function companyDartRows(profile = {}, financials = {}) {
  const company = profile.company || {};
  const dart = financials.openDart || {};
  const financialRows = normalizeDartFinancialRows(profile, financials);
  const latest = financialRows[0] || {};
  return [
    ['표준기업명', firstDefined(company.tenantMasterName, profile.tenantMasterName, dart.corp_name, '-')],
    ['사업자번호', formatBusinessRegistrationNo(firstDefined(company.businessRegistrationNo, profile.businessRegistrationNo))],
    ['대표자명', firstDefined(dart.ceo_nm, company.representativeName, company.ceoName, '-')],
    ['개업일자', formatCompactDate(firstDefined(dart.open_date, dart.openDate, company.openingDate, company.businessStartDate))],
    ['설립일자', formatCompactDate(firstDefined(dart.est_dt, company.establishmentDate, company.estDt))],
    ['종업원수', firstDefined(dart.employee_count, dart.employeeCount, financials.employeeCount, company.latestEmployeeCount) == null ? '-' : `${formatNumber(firstDefined(dart.employee_count, dart.employeeCount, financials.employeeCount, company.latestEmployeeCount))}명`],
    ['표준산업분류(11차)', firstDefined(dart.ksic_11, dart.ksic11, dart.industry_name, dart.industryName, company.standardIndustryClassification, company.industryName, company.industryCode, '-')],
    ['주요 상품', firstDefined(dart.main_products, dart.mainProducts, company.mainProducts, company.majorProducts, '-')],
    ['본사 주소', firstDefined(dart.adres, company.headquartersAddress, profile.headquartersAddress, '-')],
    ['법인등록번호', firstDefined(dart.jurir_no, company.corpRegistrationNo, '-')],
    ['상장여부', company.listedYn || '-'],
    ['그룹명', company.groupName || '-'],
    ['OpenDART 기업명', dart.corp_name || '-'],
    ['OpenDART 법인구분', dart.corp_cls || '-'],
    ['OpenDART 결산월', dart.acc_mt || '-'],
    ['최근 재무제표 연도', firstDefined(latest.year, company.latestFinancialYear, '-')],
    ['회사채 신용등급', firstDefined(latest.creditRating, dart.credit_rating, company.creditRating, '-')],
    ['총 자산', formatCurrency(firstDefined(latest.totalAssets, company.latestTotalAssets, dart.total_assets))],
    ['총 부채', formatCurrency(firstDefined(latest.totalLiabilities, company.latestTotalLiabilities, dart.total_liabilities))],
    ['총 자본', formatCurrency(firstDefined(latest.totalEquity, company.latestTotalEquity, dart.total_equity))],
    ['매출액', formatCurrency(firstDefined(latest.revenue, financials.revenue, company.latestRevenue, dart.revenue))],
    ['영업이익', formatCurrency(firstDefined(latest.operatingIncome, financials.operatingIncome, company.latestOperatingIncome, dart.operating_income))],
    ['당기순이익', formatCurrency(firstDefined(latest.netIncome, financials.netIncome, company.latestNetIncome, dart.net_income))],
    ['부채비율', firstDefined(financials.debtRatio, company.latestDebtRatio) == null ? '-' : `${formatNumber(firstDefined(financials.debtRatio, company.latestDebtRatio))}%`],
  ];
}

function normalizeFinancialYear(value) {
  const text = cleanDisplay(value, '');
  const match = text.match(/20\d{2}/u);
  return match ? match[0] : text;
}

function numberOrNull(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const numeric = Number(String(value).replace(/[,\s원]/gu, ''));
  return Number.isFinite(numeric) ? numeric : null;
}

function accountMetricKey(name) {
  const text = cleanDisplay(name, '');
  if (/매출|수익|영업수익|revenue|sales/iu.test(text)) return 'revenue';
  if (/영업이익|operating/iu.test(text)) return 'operatingIncome';
  if (/당기순이익|순이익|net\s*income/iu.test(text)) return 'netIncome';
  if (/자산총계|총\s*자산|total\s*assets/iu.test(text)) return 'totalAssets';
  if (/부채총계|총\s*부채|total\s*liabil/iu.test(text)) return 'totalLiabilities';
  if (/자본총계|총\s*자본|total\s*equity/iu.test(text)) return 'totalEquity';
  return '';
}

function normalizeDartFinancialRows(profile = {}, financials = {}) {
  const company = profile.company || {};
  const dart = financials.openDart || {};
  const explicitRows = firstDefined(
    dart.financials,
    dart.financial_statements,
    dart.financialStatements,
    financials.financials,
    financials.financialStatements,
    company.financials,
    company.financialStatements,
  );
  const byYear = new Map();
  const ensureYear = (yearValue) => {
    const year = normalizeFinancialYear(yearValue || company.latestFinancialYear || financials.latestFinancialYear || '');
    if (!year) return null;
    if (!byYear.has(year)) {
      byYear.set(year, {
        year,
        creditRating: '-',
        totalAssets: null,
        totalLiabilities: null,
        totalEquity: null,
        revenue: null,
        operatingIncome: null,
        netIncome: null,
      });
    }
    return byYear.get(year);
  };
  if (Array.isArray(explicitRows)) {
    explicitRows.forEach((row) => {
      const yearRow = ensureYear(firstDefined(row.year, row.bsns_year, row.fiscalYear, row.reportYear));
      if (!yearRow) return;
      const metricKey = accountMetricKey(firstDefined(row.account_nm, row.accountName, row.metric, row.name, ''));
      if (metricKey) {
        yearRow[metricKey] = numberOrNull(firstDefined(row.amount, row.thstrm_amount, row.value, row.currentAmount));
      } else {
        yearRow.creditRating = firstDefined(row.creditRating, row.bondCreditRating, row.companyBondCreditRating, yearRow.creditRating);
        yearRow.totalAssets = firstDefined(numberOrNull(row.totalAssets), yearRow.totalAssets);
        yearRow.totalLiabilities = firstDefined(numberOrNull(row.totalLiabilities), yearRow.totalLiabilities);
        yearRow.totalEquity = firstDefined(numberOrNull(row.totalEquity), yearRow.totalEquity);
        yearRow.revenue = firstDefined(numberOrNull(row.revenue), yearRow.revenue);
        yearRow.operatingIncome = firstDefined(numberOrNull(row.operatingIncome), yearRow.operatingIncome);
        yearRow.netIncome = firstDefined(numberOrNull(row.netIncome), yearRow.netIncome);
      }
    });
  }
  const latestYear = normalizeFinancialYear(firstDefined(company.latestFinancialYear, financials.latestFinancialYear, dart.bsns_year, ''));
  if (latestYear && !byYear.has(latestYear)) {
    byYear.set(latestYear, {
      year: latestYear,
      creditRating: firstDefined(company.creditRating, financials.creditRating, '-'),
      totalAssets: numberOrNull(firstDefined(company.latestTotalAssets, financials.totalAssets, dart.total_assets)),
      totalLiabilities: numberOrNull(firstDefined(company.latestTotalLiabilities, financials.totalLiabilities, dart.total_liabilities)),
      totalEquity: numberOrNull(firstDefined(company.latestTotalEquity, financials.totalEquity, dart.total_equity)),
      revenue: numberOrNull(firstDefined(financials.revenue, company.latestRevenue, dart.revenue)),
      operatingIncome: numberOrNull(firstDefined(financials.operatingIncome, company.latestOperatingIncome, dart.operating_income)),
      netIncome: numberOrNull(firstDefined(financials.netIncome, company.latestNetIncome, dart.net_income)),
    });
  }
  return [...byYear.values()]
    .sort((a, b) => String(b.year).localeCompare(String(a.year), 'ko-KR', { numeric: true }))
    .slice(0, 3);
}

function companyDartDetailRows(profile = {}, financials = {}) {
  const company = profile.company || {};
  const dart = financials.openDart || {};
  return [
    ['대표자명', firstDefined(dart.ceo_nm, company.representativeName, company.ceoName, '-')],
    ['개업일자', formatCompactDate(firstDefined(dart.open_date, dart.openDate, company.openingDate, company.businessStartDate))],
    ['설립일자', formatCompactDate(firstDefined(dart.est_dt, company.establishmentDate, company.estDt))],
    ['종업원수', firstDefined(dart.employee_count, dart.employeeCount, financials.employeeCount, company.latestEmployeeCount) == null ? '-' : `${formatNumber(firstDefined(dart.employee_count, dart.employeeCount, financials.employeeCount, company.latestEmployeeCount))}명`],
    ['표준산업분류(11차)', firstDefined(dart.ksic_11, dart.ksic11, dart.industry_name, dart.industryName, company.standardIndustryClassification, company.industryName, company.industryCode, '-')],
    ['주요 상품', firstDefined(dart.main_products, dart.mainProducts, company.mainProducts, company.majorProducts, '-')],
    ['본사 주소', firstDefined(dart.adres, company.headquartersAddress, profile.headquartersAddress, '-')],
  ];
}

function financialMetricRows(financialRows = []) {
  return (financialRows.length ? financialRows : [{ year: '-', creditRating: '-', totalAssets: null, totalLiabilities: null, totalEquity: null, revenue: null, operatingIncome: null, netIncome: null }]).map((row) => [
    row.year || '-',
    row.creditRating || '-',
    formatCurrency(row.totalAssets),
    formatCurrency(row.totalLiabilities),
    formatCurrency(row.totalEquity),
    formatCurrency(row.revenue),
    formatCurrency(row.operatingIncome),
    formatCurrency(row.netIncome),
  ]);
}

function DartFinancialTrendChart({ rows }) {
  const chartRef = useRef(null);
  const [hoveredMetric, setHoveredMetric] = useState(null);
  const metrics = [
    { key: 'revenue', label: '매출액', color: '#9AD7FF' },
    { key: 'operatingIncome', label: '영업이익', color: '#B5E48C' },
    { key: 'netIncome', label: '당기순이익', color: '#FFD166' },
  ];
  const chartRows = (rows || []).slice().reverse();
  const chartValues = chartRows.flatMap((row) => metrics.map((metric) => Math.abs(Number(row[metric.key] || 0))));
  const maxValue = Math.max(...chartValues, 1);
  if (!chartRows.length || maxValue <= 1) {
    return <div className="rounded-[12px] border border-[#333333] bg-[#1F1F1E] p-4 text-[13px] text-[#86868B]">차트로 표시할 3개년 재무 수치가 없습니다.</div>;
  }
  return (
    <div ref={chartRef} onMouseLeave={() => setHoveredMetric(null)} className="relative rounded-[12px] border border-[#333333] bg-[#1F1F1E] p-4">
      <div className="mb-3 flex flex-wrap items-center gap-4 text-[12px] text-[#C7C7CC]">
        {metrics.map((metric) => (
          <span key={metric.key} className="inline-flex items-center gap-2">
            <span className="h-2 w-5 rounded-full" style={{ backgroundColor: metric.color }} />
            {metric.label}
          </span>
        ))}
      </div>
      <div className="grid min-h-[220px] grid-cols-1 gap-4 md:grid-cols-3">
        {chartRows.map((row) => (
          <div key={row.year} className="flex flex-col justify-end rounded-[10px] bg-[#151515] p-3">
            <div className="mb-2 flex h-[150px] items-end justify-center gap-3">
              {metrics.map((metric) => {
                const value = Number(row[metric.key] || 0);
                return (
                  <div
                    key={metric.key}
                    className="flex h-full w-10 flex-col justify-end"
                    title={`${row.year} ${metric.label}: ${formatCurrency(value)}`}
                    onMouseEnter={(event) => setHoveredMetric({ year: row.year, label: metric.label, value, color: metric.color, ...getTooltipPoint(event, chartRef.current, 250, 110) })}
                    onMouseMove={(event) => setHoveredMetric({ year: row.year, label: metric.label, value, color: metric.color, ...getTooltipPoint(event, chartRef.current, 250, 110) })}
                  >
                    <div className="rounded-t-[6px]" style={{ height: `${Math.max(4, Math.abs(value) / maxValue * 100)}%`, backgroundColor: metric.color, opacity: value < 0 ? 0.55 : 1 }} />
                  </div>
                );
              })}
            </div>
            <div className="text-center text-[13px] font-bold text-white">{row.year}</div>
          </div>
        ))}
      </div>
      {hoveredMetric ? (
        <div data-testid="dart-financial-tooltip" className="pointer-events-none fixed z-50 w-[250px] rounded-[8px] border border-[#3A3A3C] bg-[#101010]/95 px-3 py-2 text-[12px] text-white shadow-xl" style={{ left: hoveredMetric.x, top: hoveredMetric.y }}>
          <div className="flex items-center gap-2 font-semibold">
            <span className="h-2 w-5 rounded-full" style={{ backgroundColor: hoveredMetric.color }} />
            {hoveredMetric.year} {hoveredMetric.label}
          </div>
          <div className="mt-1 text-[#D1D1D6]">{formatCurrency(hoveredMetric.value)}</div>
        </div>
      ) : null}
    </div>
  );
}

function CompanyDartDetailView({ profile, financials }) {
  const rows = normalizeDartFinancialRows(profile, financials);
  return (
    <div className="space-y-5">
      <section>
        <h4 className="mb-3 text-[15px] font-bold text-white">기업 정보</h4>
        <DataTable headers={['항목', '값']} rows={companyDartDetailRows(profile, financials)} compact minTableWidth={null} />
      </section>
      <section>
        <h4 className="mb-3 text-[15px] font-bold text-white">최근 3개년 재무제표 주요 지표</h4>
        <DataTable
          headers={['연도', '회사채 신용등급', '총 자산', '총 부채', '총 자본', '매출액', '영업이익', '당기순이익']}
          rows={financialMetricRows(rows)}
          compact
        />
      </section>
      <section>
        <h4 className="mb-3 text-[15px] font-bold text-white">매출액 · 영업이익 · 당기순이익 추이</h4>
        <DartFinancialTrendChart rows={rows} />
      </section>
    </div>
  );
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
    const tenantName = firstHumanTenantName(row.tenantMasterName, row.tenantName, row.companyName) || '미분류 임차인';
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
  const kpis = normalizeKpiList(payload.kpis).map((item) => ({ ...item }));
  let normalizedRows = rows;

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
  const canUseExternalApiRefresh = canViewAdvancedLogisticsTools(memberInfo, permission);
  const dashboardDataset = useDashboardHomeReadDataset(memberInfo);
  const readableCompanyOptions = useMemo(() => (
    dashboardDataset.companyOptions
  ), [dashboardDataset.companyOptions]);
  const storedTenantId = typeof window !== 'undefined' ? window.sessionStorage.getItem('logisticsSelectedTenantId') : '';
  const defaultTenantId = storedTenantId && readableCompanyOptions.some((item) => item.tenantId === storedTenantId)
    ? storedTenantId
    : readableCompanyOptions[0]?.tenantId || '';
  const [selectedTenantId, setSelectedTenantId] = useState(defaultTenantId);
  const [exposureMode, setExposureMode] = useState('cost');
  const [modal, setModal] = useState(null);
  const [dartApiStatus, setDartApiStatus] = useState(null);
  const [dartApiSummary, setDartApiSummary] = useState(null);
  useEffect(() => {
    if (!readableCompanyOptions.length) return;
    if (readableCompanyOptions.some((item) => item.tenantId === selectedTenantId)) return;
    const nextTenantId = readableCompanyOptions[0]?.tenantId;
    if (!nextTenantId) return;
    window.sessionStorage.setItem('logisticsSelectedTenantId', nextTenantId);
    setSelectedTenantId(nextTenantId);
    setDartApiStatus(null);
    setDartApiSummary(null);
  }, [readableCompanyOptions, selectedTenantId]);
  const staticRawPayload = COMPANY_PAYLOADS[selectedTenantId] || COMPANY_PAYLOADS[defaultTenantId] || Object.values(COMPANY_PAYLOADS)[0];
  const staticCompany = useMemo(() => normalizeCompanyPayload(staticRawPayload || {}), [staticRawPayload]);
  const staticCompanyAssets = staticCompany.normalizedLeasedAssets || [];
  const staticCompanySummary = {
    asset_count: new Set(staticCompanyAssets.map((row) => row.assetName)).size,
    leased_area_sqm: sumRows(staticCompanyAssets, (row) => row.leasedAreaSqm),
    current_monthly_rent_total: sumRows(staticCompanyAssets, (row) => row.monthlyRentTotal),
    current_monthly_mf_total: sumRows(staticCompanyAssets, (row) => row.monthlyMfTotal),
    current_monthly_cost_total: sumRows(staticCompanyAssets, (row) => row.monthlyCostTotal),
  };
  const companyReadAdapter = useMemo(() => (
    (response) => companyPayloadFromDashboardRead(response, staticRawPayload)
  ), [staticRawPayload]);
  const companyRead = useDashboardReadBridge('dashboard/company/read', { basis_date: DASHBOARD_BASIS_DATE, tenant_id: selectedTenantId }, staticCompanySummary, companyReadAdapter, Boolean(selectedTenantId));
  const rawPayload = useMemo(() => (
    companyRead.payload || (companyRead.primaryMode && !companyRead.fallbackAllowed
      ? { profile: {}, leasedAssets: [], rows: [], mapPoints: [], operations: {} }
      : staticRawPayload)
  ), [companyRead.fallbackAllowed, companyRead.payload, companyRead.primaryMode, staticRawPayload]);
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
  const kpiLookup = kpiLookupFrom(company.kpis);
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
    shareValue: exposureTotal ? Number(row.value || 0) / exposureTotal : 0,
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
    formatPercent(exposureTotal ? Number(row.value || 0) / exposureTotal : 0),
  ]);
  const openTableModal = (title, headers, rows) => setModal({ title, headers, rows });
  const selectedCorpCode = String(firstDefined(profile.company?.dartCorpCode, profile.dartCorpCode, financials.dartCorpCode, '') || '').trim();
  const openDartDetailModal = (dartOverride = dartApiSummary) => setModal({
    title: 'DART 상세 정보',
    size: 'wide',
    content: <CompanyDartDetailView profile={profile} financials={{ ...financials, openDart: dartOverride }} />,
  });
  useEffect(() => {
    if (!selectedCorpCode) {
      setDartApiSummary(null);
      return undefined;
    }
    let cancelled = false;
    supabase.functions.invoke('ll-dashboard-api', {
      body: { action: 'opendart/company', payload: { corp_code: selectedCorpCode, include_financials: true } },
    }).then(({ data, error }) => {
      if (cancelled) return;
      if (error || data?.ok === false) return;
      setDartApiSummary(data?.data || null);
      if (data?.cache?.stale) {
        setDartApiStatus({ type: 'blocked', message: 'OpenDART 실시간 조회가 실패해 기존 저장값을 표시하고 있습니다.' });
      } else {
        setDartApiStatus(null);
      }
    }).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [selectedCorpCode]);
  const refreshOpenDart = async () => {
    if (!selectedCorpCode) {
      setDartApiStatus({ type: 'blocked', message: 'OpenDART 조회에 필요한 corp_code가 없습니다. DB_기업 매칭값을 먼저 확인해야 합니다.' });
      return;
    }
    setDartApiStatus({ type: 'loading', message: 'OpenDART 원천 API를 다시 호출하고 Supabase 저장값을 갱신하는 중입니다.' });
    try {
      const { data, error } = await supabase.functions.invoke('ll-dashboard-api', {
        body: { action: 'opendart/company', payload: { corp_code: selectedCorpCode, include_financials: true, force_refresh: true } },
      });
      if (error) throw error;
      const dart = data?.data || {};
      if (!data?.ok) {
        setDartApiStatus({ type: 'blocked', message: `OpenDART provider 상태 확인 필요: ${data?.provider_status || '-'}` });
        return;
      }
      setDartApiSummary(dart);
      setDartApiStatus(data?.cache?.stale
        ? { type: 'blocked', message: 'OpenDART 실시간 원천 호출이 실패해 기존 저장값을 표시했습니다. 이 경우 새로고침 완료로 보지 않습니다.' }
        : { type: 'success', message: 'OpenDART 원천 API 결과를 Supabase 저장값에 반영했습니다.' });
      openDartDetailModal(dart);
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
      {companyRead.blocked ? (
        <DashboardAccessState title="Dashboard read blocked" message="Supabase read API가 현재 로그인 사용자의 선택 기업 노출자산 읽기 권한을 허용하지 않아 정적 JSON fallback을 차단했습니다." />
      ) : null}
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
            setDartApiSummary(null);
          }} className="h-10 min-w-[280px] rounded-[8px] border border-[#3A3A3C] bg-[#1F1F1E] px-3 text-[13px] text-white">
            {readableCompanyOptions.map((item) => <option key={item.tenantId} value={item.tenantId}>{item.tenantMasterName}</option>)}
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
        <SectionHeader eyebrow="LEASED ASSETS" title="임차 자산 현황" />
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
                {canUseExternalApiRefresh ? <button type="button" onClick={refreshOpenDart} className="h-9 px-3 rounded-[8px] bg-white text-[#1F1F1E] text-[13px] font-semibold hover:bg-[#E5E5E5]">OpenDART 새로 조회</button> : null}
                <button type="button" onClick={() => openDartDetailModal()} className="h-9 px-3 rounded-[8px] bg-[#30302F] text-white text-[13px] font-semibold hover:bg-[#3A3A3A]">상세 보기</button>
              </div>
            )}
          />
          <DataTable headers={['항목', '값']} rows={companyDartRows(profile, { ...financials, openDart: dartApiSummary })} compact />
          <div className="mt-4">
            <DartFinancialTrendChart rows={normalizeDartFinancialRows(profile, { ...financials, openDart: dartApiSummary })} />
          </div>
          {dartApiStatus ? (
            <div className={`mt-4 rounded-[12px] border px-4 py-3 text-[12px] leading-5 ${dartApiStatus.type === 'success' ? 'border-[#2E6B45] bg-[#173522] text-[#B5E48C]' : dartApiStatus.type === 'loading' ? 'border-[#34537A] bg-[#202C3D] text-[#9AD7FF]' : 'border-[#7A2E2E] bg-[#2A1414] text-[#FFB4B4]'}`}>
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
              <button type="button" onClick={() => openTableModal('자산별 노출도', ['자산명', '임대면적(평)', '월 임대료', '월 관리비', '월 임관리비', '비율'], exposureTableRows)} className="h-9 px-3 rounded-[8px] bg-[#30302F] text-white text-[13px] font-semibold hover:bg-[#3A3A3A]">원본 표 보기</button>
            </div>
          )}
        />
        <RichBarChart rows={exposureChartRows} labelKey="label" valueKey="value" barValueKey="shareValue" barMaxValue={1} valueType={effectiveExposureMode === 'area' ? 'area' : 'currency'} valueLabel={effectiveExposureMode === 'area' ? '자산별 임대면적(평)' : '자산별 월 임관리비'} showXAxisLabels={false} onClick={() => openTableModal('자산별 노출도', ['자산명', '임대면적(평)', '월 임대료', '월 관리비', '월 임관리비', '비율'], exposureTableRows)} />
        {!hasCostExposure && exposureMode === 'cost' ? <div className="mt-2 text-[12px] text-[#86868B]">월 임관리비 값이 비어 있어 임대면적 기준으로 표시했습니다.</div> : null}
      </section>
    </div>
  );
}

function AnalysisToolsDashboard() {
  const { memberInfo } = useAuth();
  const permission = useMemo(() => resolveLogisticsPermission(memberInfo), [memberInfo]);
  const dashboardDataset = useDashboardHomeReadDataset(memberInfo);
  const readableAssetOptions = useMemo(() => filterAssetsByPermission(dashboardDataset.assetOptions, permission), [dashboardDataset.assetOptions, permission]);
  const sourceRows = useMemo(() => filterAssetsByPermission(dashboardDataset.generalRows, permission), [dashboardDataset.generalRows, permission]);
  const readableCompanyOptions = useMemo(() => (
    companyOptionsFromDashboardRows(sourceRows, companyOptionsData)
  ), [sourceRows]);
  const defaultAssetIds = useMemo(() => readableAssetOptions.slice(0, 3).map((item) => item.assetId), [readableAssetOptions]);
  const defaultCompanyIds = useMemo(() => readableCompanyOptions.slice(0, 3).map((item) => item.tenantId), [readableCompanyOptions]);
  const [selectedAssetIds, setSelectedAssetIds] = useState(defaultAssetIds);
  const [selectedCompanyIds, setSelectedCompanyIds] = useState(defaultCompanyIds);
  const [benchmarkMetric, setBenchmarkMetric] = useState('monthlyCostTotal');
  const [activeBenchmarkMatrix, setActiveBenchmarkMatrix] = useState('asset');
  const [modal, setModal] = useState(null);
  const effectiveSelectedAssetIds = selectedAssetIds.length ? selectedAssetIds : defaultAssetIds;
  const effectiveSelectedCompanyIds = selectedCompanyIds.length ? selectedCompanyIds : defaultCompanyIds;
  const selectedAssetSet = new Set(effectiveSelectedAssetIds);
  const selectedCompanySet = new Set(effectiveSelectedCompanyIds);
  const allAnalysisRows = readableAssetOptions.map((assetOption) => {
    const assetContracts = sourceRows.filter((row) => row.assetId === assetOption.assetId || normalizeAssetNameKey(row.assetName) === normalizeAssetNameKey(assetOption.assetName));
    const leasedAreaSqm = sumRows(assetContracts, (row) => row.leasedAreaSqm);
    const monthlyRentTotal = sumRows(assetContracts, (row) => firstDefined(row.currentMonthlyRentTotal, row.monthlyRentTotal));
    const monthlyMfTotal = sumRows(assetContracts, (row) => firstDefined(row.currentMonthlyMfTotal, row.monthlyMfTotal));
    const monthlyCostTotal = sumRows(assetContracts, (row) => firstDefined(row.monthlyCostTotal, row.monthlyCombinedTotal));
    const grossFloorAreaSqm = Number(firstDefined(assetOption.grossFloorAreaSqm, 0) || 0);
    const vacancyAreaSqm = Math.max(0, grossFloorAreaSqm - Number(leasedAreaSqm || 0));
    const averageENoc = calculateWeightedENoc(assetContracts, assetOption.averageENoc);
    return {
      assetId: assetOption.assetId,
      assetName: assetOption.assetName,
      region: deriveLogisticsRegionFromAddress(assetOption.standardizedAddress || assetOption.address, '미분류'),
      monthlyRentTotal,
      monthlyMfTotal,
      monthlyCostTotal,
      vacancyRate: grossFloorAreaSqm > 0 ? vacancyAreaSqm / grossFloorAreaSqm : assetOption.vacancyRate,
      leasedAreaSqm,
      grossFloorAreaSqm,
      currentRentPerPy: calculatePerPy(monthlyRentTotal, leasedAreaSqm),
      currentMfPerPy: calculatePerPy(monthlyMfTotal, leasedAreaSqm),
      averageENoc,
      eNoc: averageENoc,
    };
  }).filter((item) => item.assetName);
  const rows = allAnalysisRows.filter((row) => selectedAssetSet.has(row.assetId));
  const benchmarkMetricDef = metricDefinition(benchmarkMetric);
  const selectedContracts = sourceRows
    .filter((row) => selectedAssetSet.has(row.assetId) || selectedCompanySet.has(row.tenantId))
    .sort((a, b) => Number(b.monthlyCostTotal || 0) - Number(a.monthlyCostTotal || 0));
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
      {dashboardDataset.blocked ? (
        <DashboardAccessState title="Dashboard read blocked" message="Supabase read API가 현재 로그인 사용자의 Analysis 데이터 읽기 권한을 허용하지 않아 정적 JSON fallback을 차단했습니다." />
      ) : null}
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
                <button key={item.assetId} type="button" onClick={() => toggleValue(item.assetId, effectiveSelectedAssetIds, setSelectedAssetIds)} className={`cursor-pointer rounded-[8px] border px-3 py-2 text-left text-[12px] font-semibold ${effectiveSelectedAssetIds.includes(item.assetId) ? 'border-white bg-white text-[#1F1F1E]' : 'border-[#3A3A3C] bg-[#252524] text-[#A1A1AA] hover:text-white'}`}>
                  {item.assetName}
                </button>
              ))}
            </div>
          </div>
          <div className="mb-4 grid grid-cols-3 gap-2">
            {[
              ['선택 자산', `${formatNumber(effectiveSelectedAssetIds.length)}개`],
              ['선택 평균', formatMetric(selectedAverage, benchmarkMetricDef.type)],
              ['전체 평균', formatMetric(portfolioAverage, benchmarkMetricDef.type)],
            ].map(([label, value]) => (
              <button key={label} type="button" onClick={() => setModal({ title: '자산 비교 원본 표', headers: ['자산명', '권역', '연면적(평)', '임대면적(평)', '공실률', benchmarkMetricDef.label, '평균 E.NOC'], rows: tableRows })} className="cursor-pointer rounded-[12px] border border-[#333333] bg-[#1F1F1E] p-3 text-left hover:bg-[#2A2A29]">
                <div className="text-[11px] font-semibold text-[#86868B]">{label}</div>
                <div className="mt-2 text-[17px] font-bold text-white">{value}</div>
              </button>
            ))}
          </div>
          <RichBarChart rows={rows.map((row) => ({ ...row, value: metricValueFromRow(row, benchmarkMetric) }))} labelKey="assetName" valueKey="value" valueType={benchmarkMetricDef.type} valueLabel={benchmarkMetricDef.label} showXAxisLabels={false} onClick={() => setModal({ title: '자산 비교', headers: ['자산명', benchmarkMetricDef.label, '공실률', '임대면적(평)', '월 임관리비'], rows: rows.map((row) => [row.assetName, formatMetric(metricValueFromRow(row, benchmarkMetric), benchmarkMetricDef.type), formatPercent(row.vacancyRate), formatArea(row.leasedAreaSqm), formatCurrency(row.monthlyCostTotal)]) })} />
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
                <button key={item.tenantId} type="button" onClick={() => toggleValue(item.tenantId, effectiveSelectedCompanyIds, setSelectedCompanyIds)} className={`cursor-pointer rounded-[8px] border px-3 py-2 text-left text-[12px] font-semibold ${effectiveSelectedCompanyIds.includes(item.tenantId) ? 'border-white bg-white text-[#1F1F1E]' : 'border-[#3A3A3C] bg-[#252524] text-[#A1A1AA] hover:text-white'}`}>
                  {item.tenantMasterName}
                </button>
              ))}
            </div>
          </div>
          <div className="mb-4 grid grid-cols-3 gap-2">
            {[
              ['선택 기업', `${formatNumber(effectiveSelectedCompanyIds.length)}개`],
              ['계약 원장', `${formatNumber(selectedContracts.length)}건`],
              ['임관리비 spread', formatCurrency(rentSpread)],
            ].map(([label, value]) => (
              <button key={label} type="button" onClick={() => setModal({ title: '계약 원장', headers: ['자산', '임차인', '구역', '임대면적(평)', '월 임대료', '월 관리비', '월 임관리비', '만기', '검토 상태'], rows: contractRows })} className="cursor-pointer rounded-[12px] border border-[#333333] bg-[#1F1F1E] p-3 text-left hover:bg-[#2A2A29]">
                <div className="text-[11px] font-semibold text-[#86868B]">{label}</div>
                <div className="mt-2 text-[17px] font-bold text-white">{value}</div>
              </button>
            ))}
          </div>
          <RichBarChart rows={companyCompareRows} labelKey="tenantMasterName" valueKey="metricValue" valueType={benchmarkMetricDef.type} valueLabel={benchmarkMetricDef.label} showXAxisLabels={false} onClick={() => setModal({ title: '기업 비교', headers: ['기업명', '자산 목록', '계약 수', '임대면적(평)', '월 임대료', '월 관리비', '월 임관리비', benchmarkMetricDef.label], rows: companyTableRows })} />
        </div>
      </section>
      <section
        className="grid grid-cols-1 gap-5 xl:grid-cols-2"
        style={{ gridTemplateColumns: activeBenchmarkMatrix === 'asset' ? 'minmax(0, 1fr) 84px' : '84px minmax(0, 1fr)' }}
      >
        <div className={`rounded-[20px] border border-[#333333] bg-[#252524] p-5 transition-all duration-300 ${activeBenchmarkMatrix === 'asset' ? 'min-w-0' : 'flex min-h-[280px] items-center justify-center p-3'}`}>
          <button type="button" onClick={() => setActiveBenchmarkMatrix('asset')} className={`flex w-full items-center justify-between text-left ${activeBenchmarkMatrix === 'asset' ? 'mb-4' : 'h-full justify-center'}`}>
            <span>
              <span className={`block text-[12px] font-semibold uppercase tracking-[0.12em] text-[#86868B] ${activeBenchmarkMatrix === 'asset' ? '' : '[writing-mode:vertical-rl]'}`}>ASSET MATRIX</span>
              {activeBenchmarkMatrix === 'asset' ? <span className="mt-1 block text-[18px] font-bold text-white">자산 벤치마크 매트릭스</span> : null}
            </span>
            {activeBenchmarkMatrix === 'asset' ? <span className="rounded-[8px] border border-[#3A3A3C] bg-[#1F1F1E] px-3 py-1.5 text-[12px] font-semibold text-[#D1D1D6]">펼침</span> : null}
          </button>
          {activeBenchmarkMatrix === 'asset' ? (
            <DataTable headers={['자산명', '권역', '연면적(평)', '임대면적(평)', '공실률', benchmarkMetricDef.label, '전체 평균 대비', '순위', '평균 E.NOC']} rows={tableRows} onRowClick={(index) => openAnalysisAssetDetail(rows[index])} compact />
          ) : null}
        </div>
        <div className={`rounded-[20px] border border-[#333333] bg-[#252524] p-5 transition-all duration-300 ${activeBenchmarkMatrix === 'company' ? 'min-w-0' : 'flex min-h-[280px] items-center justify-center p-3'}`}>
          <button type="button" onClick={() => setActiveBenchmarkMatrix('company')} className={`flex w-full items-center justify-between text-left ${activeBenchmarkMatrix === 'company' ? 'mb-4' : 'h-full justify-center'}`}>
            <span>
              <span className={`block text-[12px] font-semibold uppercase tracking-[0.12em] text-[#86868B] ${activeBenchmarkMatrix === 'company' ? '' : '[writing-mode:vertical-rl]'}`}>COMPANY MATRIX</span>
              {activeBenchmarkMatrix === 'company' ? <span className="mt-1 block text-[18px] font-bold text-white">기업 벤치마크 매트릭스</span> : null}
            </span>
            {activeBenchmarkMatrix === 'company' ? <span className="rounded-[8px] border border-[#3A3A3C] bg-[#1F1F1E] px-3 py-1.5 text-[12px] font-semibold text-[#D1D1D6]">펼침</span> : null}
          </button>
          {activeBenchmarkMatrix === 'company' ? (
            <DataTable headers={['기업명', '자산 목록', '계약 수', '임대면적(평)', '월 임대료', '월 관리비', '월 임관리비', benchmarkMetricDef.label]} rows={companyTableRows} compact />
          ) : null}
        </div>
      </section>
    </div>
  );
}

function DataPlaygroundDashboard() {
  const { memberInfo } = useAuth();
  const permission = useMemo(() => resolveLogisticsPermission(memberInfo), [memberInfo]);
  const dashboardDataset = useDashboardHomeReadDataset(memberInfo);
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
  const sourceRows = useMemo(() => filterAssetsByPermission(dashboardDataset.generalRows, permission), [dashboardDataset.generalRows, permission]);
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
      {dashboardDataset.blocked ? (
        <DashboardAccessState title="Dashboard read blocked" message="Supabase read API가 현재 로그인 사용자의 Pivot Table 데이터 읽기 권한을 허용하지 않아 정적 JSON fallback을 차단했습니다." />
      ) : null}
      <section className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
        <SectionHeader
          eyebrow="PIVOT TABLE"
          title="Pivot Table"
          right={<button type="button" onClick={() => setModal({ title: 'Pivot Table 피벗 결과', size: 'wide', headers: tableHeaders, rows: tableRows })} className="h-9 cursor-pointer rounded-[8px] bg-[#30302F] px-3 text-[13px] font-semibold text-white hover:bg-[#3A3A3A]">피벗 결과 크게 보기</button>}
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
        }))} labelKey="label" valueKey="value" valueType={metricDef.type} valueLabel={`${aggregationLabel} ${metricDef.label}`} showXAxisLabels={false} onClick={() => setModal({ title: 'Pivot Table 차트 상세', size: 'wide', headers: tableHeaders, rows: tableRows })} />
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

const CONTRACT_EVENT_TYPES = [
  ['correction', '오입력 정정'],
  ['new_lease', '신규 계약'],
  ['extension', '연장 계약'],
  ['rent_change', '임대료/관리비 변경'],
  ['concession_change', 'RF/FO/TI 변경'],
  ['expiry_vacancy', '만료/공실 전환'],
  ['partial_vacancy', '부분공실'],
  ['space_split', '층/구역 분할'],
];

function ContractDataManagementDashboard() {
  const { memberInfo } = useAuth();
  const permission = useMemo(() => resolveLogisticsPermission(memberInfo), [memberInfo]);
  const dashboardDataset = useDashboardHomeReadDataset(memberInfo, Boolean(memberInfo));
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [selectedLeaseSpaceId, setSelectedLeaseSpaceId] = useState('');
  const [eventType, setEventType] = useState('correction');
  const [summary, setSummary] = useState('');
  const [eventStatus, setEventStatus] = useState(null);
  const [submittedEvents, setSubmittedEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldDrafts, setFieldDrafts] = useState({});
  const [fieldEditStatus, setFieldEditStatus] = useState(null);
  const [isSubmittingFields, setIsSubmittingFields] = useState(false);

  const readableRows = useMemo(() => filterAssetsByPermission(dashboardDataset.generalRows || [], permission), [dashboardDataset.generalRows, permission]);
  const readableAssets = useMemo(() => filterAssetsByPermission(dashboardDataset.assetOptions || [], permission), [dashboardDataset.assetOptions, permission]);
  const activeAssetId = selectedAssetId || readableAssets[0]?.assetId || '';
  const assetRows = useMemo(() => readableRows.filter((row) => !activeAssetId || row.assetId === activeAssetId), [activeAssetId, readableRows]);
  const selectedAsset = readableAssets.find((asset) => asset.assetId === activeAssetId) || {};
  const selectedLeaseRow = assetRows.find((row) => row.leaseSpaceId === selectedLeaseSpaceId) || assetRows[0] || {};
  const selectedLeaseRowDraftKey = CONTRACT_DATA_FIELDS.map((field) => (
    `${field.fieldName}:${excelCellText(contractFieldRawValue(selectedLeaseRow, field))}`
  )).join('|');
  const canSubmit = Boolean(permission.permissions?.managedAsset?.update || permission.permissions?.managedAsset?.create || permission.role === 'Admin' || permission.role === 'Manager');

  useEffect(() => {
    let cancelled = false;
    const loadEvents = async () => {
      setEventsLoading(true);
      setEventsError('');
      try {
        const { data, error } = await supabase.functions.invoke('ll-dashboard-api', {
          body: { action: 'lease-events/list', payload: { limit: 120 } },
        });
        if (error) throw error;
        if (!cancelled) setSubmittedEvents(Array.isArray(data?.data) ? data.data : []);
      } catch (error) {
        if (!cancelled) {
          setSubmittedEvents([]);
          setEventsError(error?.message || '계약 변경 요청 목록을 불러오지 못했습니다.');
        }
      } finally {
        if (!cancelled) setEventsLoading(false);
      }
    };
    loadEvents();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (selectedAssetId && !assetRows.some((row) => row.leaseSpaceId === selectedLeaseSpaceId)) {
      setSelectedLeaseSpaceId(assetRows[0]?.leaseSpaceId || '');
    }
  }, [assetRows, selectedAssetId, selectedLeaseSpaceId]);

  useEffect(() => {
    setFieldDrafts(Object.fromEntries(CONTRACT_DATA_FIELDS.map((field) => [
      field.fieldName,
      excelCellText(contractFieldRawValue(selectedLeaseRow, field)),
    ])));
    setFieldEditStatus(null);
  }, [selectedLeaseRowDraftKey]);

  const contractRows = assetRows.map((row) => [
    row.assetName || '-',
    row.tenantMasterName || row.companyName || '-',
    row.spaceLabel || [row.floorLabel, row.detailAreaLabel].filter(Boolean).join(' / ') || '-',
    formatArea(row.leasedAreaSqm),
    formatCurrency(firstDefined(row.currentMonthlyRentTotal, row.monthlyRentTotal)),
    formatCurrency(firstDefined(row.currentMonthlyMfTotal, row.monthlyMfTotal)),
    formatCurrency(row.monthlyCostTotal),
    formatWon(row.eNoc),
    formatDate(firstDefined(row.currentStartDate, row.firstStartDate)),
    formatDate(firstDefined(row.currentEndDate, row.latestExpiry)),
  ]);

  const eventRows = submittedEvents.map((row) => [
    CONTRACT_EVENT_TYPES.find(([value]) => value === row.event_type)?.[1] || row.event_type || '-',
    row.asset_name || '-',
    row.tenant_name || '-',
    row.summary || '-',
    row.status || '-',
    row.created_at ? formatDate(row.created_at) : '-',
  ]);

  const submitLeaseEvent = async () => {
    if (!canSubmit) {
      setEventStatus({ type: 'error', message: '현재 계정에는 계약 데이터 수정 요청 권한이 없습니다.' });
      return;
    }
    if (!activeAssetId) {
      setEventStatus({ type: 'error', message: '자산을 먼저 선택해주세요.' });
      return;
    }
    if (!summary.trim()) {
      setEventStatus({ type: 'error', message: '변경 요약을 입력해주세요.' });
      return;
    }
    setIsSubmitting(true);
    setEventStatus({ type: 'pending', message: '계약 변경 요청을 서버 승인 대기열에 접수하는 중입니다.' });
    try {
      const { data, error } = await supabase.functions.invoke('ll-dashboard-api', {
        body: {
          action: 'lease-events/submit',
          payload: {
            event_type: eventType,
            asset_id: activeAssetId,
            asset_name: selectedAsset.assetName || selectedLeaseRow.assetName,
            tenant_name: selectedLeaseRow.tenantMasterName || selectedLeaseRow.companyName || '',
            lease_space_id: selectedLeaseRow.leaseSpaceId || '',
            effective_date: currentKstMonthEndDate(),
            summary,
            before: selectedLeaseRow,
            after: { summary },
          },
        },
      });
      if (error) throw error;
      if (data?.ok === false) throw new Error(data.message || '계약 변경 요청 접수 실패');
      const saved = data?.data ? {
        id: data.data.id,
        status: data.data.status,
        event_type: eventType,
        asset_name: selectedAsset.assetName || selectedLeaseRow.assetName,
        tenant_name: selectedLeaseRow.tenantMasterName || selectedLeaseRow.companyName || '',
        summary,
        created_at: data.data.created_at || new Date().toISOString(),
      } : null;
      if (saved) setSubmittedEvents((rows) => [saved, ...rows]);
      setSummary('');
      setEventStatus({ type: 'success', message: '계약 변경 요청이 승인 대기열에 접수됐습니다. 실제 DB 반영은 승인 후 처리됩니다.' });
    } catch (error) {
      setEventStatus({ type: 'error', message: error?.message || '계약 변경 요청 중 오류가 발생했습니다.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitContractFieldEdits = async () => {
    if (!canSubmit) {
      setFieldEditStatus({ type: 'error', message: '현재 계정에는 계약 데이터 수정 요청 권한이 없습니다.' });
      return;
    }
    const cellEdits = CONTRACT_DATA_FIELDS
      .map((field) => {
        const beforeValue = contractFieldRawValue(selectedLeaseRow, field);
        const afterValue = fieldDrafts[field.fieldName] ?? '';
        if (excelCellText(beforeValue) === excelCellText(afterValue)) return null;
        const targetTable = normalizeContractTargetTable(field.table);
        const targetRowId = contractTargetRowId(selectedLeaseRow, targetTable);
        const primaryKeyField = contractPrimaryKeyField(selectedLeaseRow, targetTable);
        if (!targetRowId || !primaryKeyField) return null;
        return {
          action: '수정',
          target_table: targetTable,
          target_row_id: targetRowId,
          primary_key_field: primaryKeyField,
          field_name: contractFieldDbName(field),
          source_row_id: selectedLeaseRow.sourceRowId || selectedLeaseRow.source_row_id || '',
          source_cell_id: selectedLeaseRow[`${field.fieldName}SourceCellId`] || '',
          before_value: beforeValue ?? '',
          after_value: afterValue,
          asset_id: selectedLeaseRow.assetId || activeAssetId,
          asset_name: selectedAsset.assetName || selectedLeaseRow.assetName || '',
        };
      })
      .filter(Boolean);
    if (!cellEdits.length) {
      setFieldEditStatus({ type: 'error', message: '변경된 필드가 없습니다.' });
      return;
    }
    setIsSubmittingFields(true);
    setFieldEditStatus({ type: 'pending', message: `${formatNumber(cellEdits.length)}개 필드를 승인 요청으로 접수하는 중입니다.` });
    try {
      const { data, error } = await supabase.functions.invoke('ll-dashboard-api', {
        body: {
          action: 'edits/submit',
          payload: {
            source_table: cellEdits[0].target_table,
            target_type: 'contract_data',
            target_name: selectedAsset.assetName || selectedLeaseRow.assetName || '',
            target_row_id: selectedLeaseRow.leaseSpaceId || selectedLeaseRow.id || '',
            field_name: 'contract_data_batch',
            reason_code: 'contract_data_user_edit',
            before_value: `${cellEdits.length}개 필드 before`,
            requested_value: `${cellEdits.length}개 필드 after`,
            request_payload: {
              kind: 'contract_data_edit',
              source: 'Data Update',
              asset_id: activeAssetId,
              asset_name: selectedAsset.assetName || selectedLeaseRow.assetName || '',
              lease_space_id: selectedLeaseRow.leaseSpaceId || '',
              tenant_name: selectedLeaseRow.tenantMasterName || selectedLeaseRow.companyName || '',
              cell_edits: cellEdits,
            },
          },
        },
      });
      if (error) throw error;
      if (data?.ok === false) throw new Error(data.message || '계약 원본 필드 수정 요청 실패');
      setFieldEditStatus({ type: 'success', message: `수정 요청이 접수됐습니다. 승인 후 Supabase 원장에 반영됩니다. 요청 ID: ${data?.data?.id || '-'}` });
    } catch (error) {
      setFieldEditStatus({ type: 'error', message: error?.message || '계약 원본 필드 수정 요청 중 오류가 발생했습니다.' });
    } finally {
      setIsSubmittingFields(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader title="Data Update" />
      <section className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
        <SectionHeader
          eyebrow="LEASE CONTRACT LEDGER"
          title="임대차계약 데이터 관리"
          right={<span className="text-[12px] font-semibold text-[#A1A1AA]">DB_일반 + DB_히스토리 누적 기준</span>}
        />
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[14px] border border-[#333333] bg-[#1F1F1E] p-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="block text-[12px] font-semibold text-[#A1A1AA]">
                자산
                <select value={activeAssetId} onChange={(event) => setSelectedAssetId(event.target.value)} className="mt-2 h-10 w-full rounded-[8px] border border-[#3A3A3C] bg-[#111] px-3 text-[13px] text-white">
                  {readableAssets.map((asset) => <option key={asset.assetId} value={asset.assetId}>{asset.assetName}</option>)}
                </select>
              </label>
              <label className="block text-[12px] font-semibold text-[#A1A1AA]">
                계약 구역
                <select value={selectedLeaseSpaceId || selectedLeaseRow.leaseSpaceId || ''} onChange={(event) => setSelectedLeaseSpaceId(event.target.value)} className="mt-2 h-10 w-full rounded-[8px] border border-[#3A3A3C] bg-[#111] px-3 text-[13px] text-white">
                  {assetRows.map((row) => <option key={row.leaseSpaceId || `${row.tenantMasterName}-${row.spaceLabel}`} value={row.leaseSpaceId}>{`${row.tenantMasterName || row.companyName || '-'} / ${row.spaceLabel || row.floorLabel || '-'}`}</option>)}
                </select>
              </label>
            </div>
            <div className="mt-4 rounded-[12px] border border-[#333333] bg-[#252524] p-4 text-[13px] leading-6 text-[#D1D1D6]">
              <div><span className="text-[#86868B]">임차인</span> {selectedLeaseRow.tenantMasterName || selectedLeaseRow.companyName || '-'}</div>
              <div><span className="text-[#86868B]">구역</span> {selectedLeaseRow.spaceLabel || selectedLeaseRow.floorLabel || '-'}</div>
              <div><span className="text-[#86868B]">월 임관리비</span> {formatCurrency(selectedLeaseRow.monthlyCostTotal)}</div>
              <div><span className="text-[#86868B]">계약기간</span> {formatDate(firstDefined(selectedLeaseRow.currentStartDate, selectedLeaseRow.firstStartDate))} ~ {formatDate(firstDefined(selectedLeaseRow.currentEndDate, selectedLeaseRow.latestExpiry))}</div>
            </div>
          </div>
          <div className="rounded-[14px] border border-[#333333] bg-[#1F1F1E] p-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[180px_1fr]">
              <label className="block text-[12px] font-semibold text-[#A1A1AA]">
                변경 유형
                <select value={eventType} onChange={(event) => setEventType(event.target.value)} className="mt-2 h-10 w-full rounded-[8px] border border-[#3A3A3C] bg-[#111] px-3 text-[13px] text-white">
                  {CONTRACT_EVENT_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="block text-[12px] font-semibold text-[#A1A1AA]">
                변경 요약
                <textarea value={summary} onChange={(event) => setSummary(event.target.value)} rows={3} className="mt-2 w-full rounded-[8px] border border-[#3A3A3C] bg-[#111] px-3 py-2 text-[13px] text-white outline-none focus:border-[#2997ff]" placeholder="예: 2026년 6월부터 임대료 변경 / 계약 연장 / 일부 공실 전환 등" />
              </label>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="text-[12px] text-[#86868B]">브라우저 직접 저장이 아니라 Edge Function 승인 요청으로 접수됩니다.</div>
              <button type="button" disabled={isSubmitting} onClick={submitLeaseEvent} className={`h-10 rounded-[8px] px-4 text-[13px] font-semibold ${PRIMARY_BLUE_BUTTON_CLASS} disabled:opacity-50`}>승인 요청</button>
            </div>
            {eventStatus ? <div className={`mt-3 rounded-[10px] border px-3 py-2 text-[12px] ${eventStatus.type === 'error' ? 'border-[#7A2E2E] bg-[#2A1414] text-[#FFB4B4]' : eventStatus.type === 'success' ? 'border-[#2E6B45] bg-[#173522] text-[#B5E48C]' : 'border-[#4C4329] bg-[#2A240E] text-[#FFD166]'}`}>{eventStatus.message}</div> : null}
          </div>
        </div>
      </section>

      <section className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
        <SectionHeader eyebrow="CURRENT CONTRACTS" title="현재 계약 원장" />
        <DataTable headers={['자산', '임차인', '층/구역', '임대면적', '월 임대료', '월 관리비', '월 임관리비', 'E. NOC', '계약개시', '계약만기']} rows={contractRows} compact />
      </section>

      <section className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
        <SectionHeader
          eyebrow="SOURCE EXCEL FIELDS"
          title="원본 Excel 전체 필드 수정 요청"
          right={<button type="button" disabled={isSubmittingFields} onClick={submitContractFieldEdits} className={`h-9 rounded-[8px] px-3 text-[12px] font-semibold ${PRIMARY_BLUE_BUTTON_CLASS} disabled:opacity-50`}>변경 필드 승인 요청</button>}
        />
        <div className="mb-3 text-[12px] leading-5 text-[#A1A1AA]">
          DB_일반과 DB_히스토리 누적의 원본 항목을 선택 계약 기준으로 수정 요청합니다. 실제 저장은 관리자 승인, 승인 직전 readback, 승인 후 readback/audit 절차를 거칩니다.
        </div>
        <div className="max-h-[520px] overflow-auto rounded-[14px] border border-[#333333]">
          <table className="min-w-[1180px] w-full border-collapse text-left text-[12px]">
            <thead className="sticky top-0 z-10 bg-[#1F1F1E] text-[#A1A1AA]">
              <tr>
                <th className="w-[130px] border-b border-[#333333] px-3 py-2">시트</th>
                <th className="w-[190px] border-b border-[#333333] px-3 py-2">원본 컬럼</th>
                <th className="w-[220px] border-b border-[#333333] px-3 py-2">현재값</th>
                <th className="border-b border-[#333333] px-3 py-2">수정값</th>
              </tr>
            </thead>
            <tbody>
              {CONTRACT_DATA_FIELDS.map((field) => {
                const currentValue = excelCellText(contractFieldRawValue(selectedLeaseRow, field));
                const changed = currentValue !== excelCellText(fieldDrafts[field.fieldName] ?? '');
                return (
                  <tr key={`${field.domain}-${field.fieldName}`} className={changed ? 'bg-[#132A44]' : 'bg-[#252524]'}>
                    <td className="border-b border-[#333333] px-3 py-2 font-semibold text-[#E5E5EA]">{field.domain}</td>
                    <td className="border-b border-[#333333] px-3 py-2 text-[#D1D1D6]">{field.sourceColumnLetter ? `${field.sourceColumnLetter}. ` : ''}{field.label}</td>
                    <td className="border-b border-[#333333] px-3 py-2 text-[#A1A1AA]">{qualityDisplayValue(field, contractFieldRawValue(selectedLeaseRow, field))}</td>
                    <td className="border-b border-[#333333] px-3 py-2">
                      <input
                        value={fieldDrafts[field.fieldName] ?? ''}
                        onChange={(event) => setFieldDrafts((previous) => ({ ...previous, [field.fieldName]: event.target.value }))}
                        className="h-8 w-full rounded-[7px] border border-[#3A3A3C] bg-[#111] px-2 text-[12px] text-white outline-none focus:border-[#2997ff]"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {fieldEditStatus ? <div className={`mt-3 rounded-[10px] border px-3 py-2 text-[12px] ${fieldEditStatus.type === 'error' ? 'border-[#7A2E2E] bg-[#2A1414] text-[#FFB4B4]' : fieldEditStatus.type === 'success' ? 'border-[#2E6B45] bg-[#173522] text-[#B5E48C]' : 'border-[#3A3A3C] bg-[#1F1F1E] text-[#A1A1AA]'}`}>{fieldEditStatus.message}</div> : null}
      </section>

      <section className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
        <SectionHeader eyebrow="APPROVAL QUEUE" title="계약 변경 승인 대기" />
        {eventsLoading ? (
          <div className="rounded-[12px] border border-[#333333] bg-[#1F1F1E] px-4 py-3 text-[13px] text-[#A1A1AA]">계약 변경 요청 목록을 불러오는 중입니다.</div>
        ) : eventsError ? (
          <div className="rounded-[12px] border border-[#7A2E2E] bg-[#2A1414] px-4 py-3 text-[13px] text-[#FFB4B4]">{eventsError}</div>
        ) : eventRows.length ? (
          <DataTable headers={['유형', '자산', '임차인', '요약', '상태', '요청일']} rows={eventRows} compact />
        ) : (
          <div className="rounded-[12px] border border-[#333333] bg-[#1F1F1E] px-4 py-3 text-[13px] text-[#A1A1AA]">접수된 계약 변경 요청이 없습니다.</div>
        )}
      </section>
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
    sheetName: row.sheet_name || row.sheetName || row.source_sheet || row.table_name || row.target_table || 'll_audit_events',
    targetType: row.target_type || row.entity_type || row.table_name || 'finding',
    target: row.target_name || row.asset_name || row.tenant_master_name || row.entity_id || row.row_ref || row.id || '-',
    field: row.field_name || row.field || row.column_name || row.rule_name || '-',
    reason: row.reason_code || row.failure_reason || row.issue_type || row.reason || row.status || 'unknown',
    action: row.suggested_fix || row.action || row.message || row.detail || '원본 값과 정규화 결과 대조 필요',
    sourceTable: row.source_table || row.sourceTable || 'public.ll_audit_events',
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
  if (/company|기업/i.test(source)) return 'public.ll_tenants';
  if (/asset|자산/i.test(source)) return 'public.ll_assets';
  if (/weekly/i.test(source)) return 'public.ll_weekly_records';
  if (source === 'public.ll_companies') return 'public.ll_tenants';
  if (source === 'public.ll_leasing_contracts') return 'public.ll_lease_spaces';
  return source.startsWith('public.ll_') ? source : 'public.ll_lease_spaces';
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
].map((field) => ({
  ...field,
  table: field.table === 'public.ll_leasing_contracts'
    ? 'public.ll_lease_spaces'
    : field.table === 'public.ll_companies'
      ? 'public.ll_tenants'
      : field.table,
}));
const CONTRACT_DATA_FIELDS = QUALITY_EXPORT_FIELDS;
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
  if (field.table === 'public.ll_lease_spaces') return String(firstDefined(row.leaseSpaceId, row.lease_space_id, row.leaseId, row.contractId, row.leaseRowId, fallbackRowId));
  return String(fallbackRowId);
}

function snakeCaseFieldName(value) {
  return String(value || '').replace(/[A-Z]/g, (match) => `_${match.toLowerCase()}`);
}

function contractFieldDbName(field) {
  return snakeCaseFieldName(field.fieldName);
}

function normalizeContractTargetTable(table) {
  if (table === 'public.ll_leasing_contracts') return 'public.ll_lease_spaces';
  if (table === 'public.ll_companies') return 'public.ll_tenants';
  return table || 'public.ll_lease_spaces';
}

function contractFieldRawValue(row, field) {
  if (!row || !field) return '';
  const snake = contractFieldDbName(field);
  return firstDefined(
    row[field.fieldName],
    row[snake],
    row.raw?.[field.sourceHeader],
    row.raw?.[field.fieldName],
    row.raw?.[snake],
    '',
  );
}

function contractPrimaryKeyField(row, targetTable) {
  if (targetTable === 'public.ll_assets') return row.assetId || row.asset_id ? 'asset_id' : 'id';
  if (targetTable === 'public.ll_tenants') return row.tenantId || row.tenant_id ? 'tenant_id' : 'id';
  if (targetTable === 'public.ll_rent_history') return row.rentHistoryId || row.rent_history_id || row.historyId || row.history_row_id ? 'rent_history_id' : 'id';
  if (targetTable === 'public.ll_lease_spaces') return row.leaseSpaceId || row.lease_space_id ? 'lease_space_id' : 'id';
  return 'id';
}

function contractTargetRowId(row, targetTable) {
  if (targetTable === 'public.ll_assets') return String(firstDefined(row.assetId, row.asset_id, row.id, ''));
  if (targetTable === 'public.ll_tenants') return String(firstDefined(row.tenantId, row.tenant_id, row.tenantRowId, row.id, ''));
  if (targetTable === 'public.ll_rent_history') return String(firstDefined(row.rentHistoryId, row.rent_history_id, row.historyId, row.history_row_id, ''));
  if (targetTable === 'public.ll_lease_spaces') return String(firstDefined(row.leaseSpaceId, row.lease_space_id, row.id, ''));
  return String(firstDefined(row.id, ''));
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

function buildQualityExcelRows(assetId, permission, findings, sourceRowsOverride = null) {
  const sourceRows = filterAssetsByPermission(sourceRowsOverride || buildLogisticsGeneralRows(), permission)
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

function OriginalDataEditPanel({ permission, sourceRows = null, assetOptions = null }) {
  const [qualityAssetId, setQualityAssetId] = useState('all');
  const [excelStatus, setExcelStatus] = useState(null);
  const excelUploadRef = useRef(null);
  const qualityFindings = useMemo(() => buildDataQualityFindings(), []);
  const qualityAssetOptions = useMemo(() => (
    filterAssetsByPermission(Array.isArray(assetOptions) ? assetOptions : assetOptionsData, permission)
      .filter((asset) => permission.permissions?.managedAsset?.update || permission.permissions?.managedAsset?.create || permission.permissions?.managedAsset?.delete || assetIdMatchesPermission(asset.assetId, asset.assetName, permission))
      .sort((a, b) => String(a.assetName || '').localeCompare(String(b.assetName || ''), 'ko-KR'))
  ), [assetOptions, permission]);
  const canUseQualityExcel = Boolean(permission.permissions?.managedAsset?.update || permission.permissions?.managedAsset?.create || permission.permissions?.managedAsset?.delete);

  const downloadQualityWorkbook = () => {
    const rows = buildQualityExcelRows(qualityAssetId, permission, qualityFindings, sourceRows);
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
            source_table: 'public.ll_audit_events',
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
  if (data?.ok === false) {
    const status = dashboardReadResponseStatus(data);
    throw new Error(`${status ? `${status} ` : ''}${data?.error || data?.message || 'Supabase quality readback failed'}`);
  }
  const rows = Array.isArray(data?.data) ? data.data : [];
  return {
    status: 'loaded',
    rows: rows.map(normalizeRemoteQualityFinding),
    message: `Edge readback public.ll_audit_events ${rows.length}건`,
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
  const findings = remoteQuality.status === 'loaded' ? remoteQuality.rows : [];
  const sourceLabel = remoteQuality.status === 'loaded'
    ? `Supabase findings ${formatNumber(remoteQuality.rows.length)}건`
    : remoteQuality.message;
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
            source_table: editTarget.sourceTable || 'public.ll_audit_events',
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
  const dashboardDataset = useDashboardHomeReadDataset(memberInfo);
  const readableAssetOptions = useMemo(() => filterAssetsByPermission(dashboardDataset.assetOptions, permission), [dashboardDataset.assetOptions, permission]);
  const storedAssetId = typeof window !== 'undefined' ? window.sessionStorage.getItem('logisticsSelectedAssetId') : '';
  const defaultAssetId = storedAssetId && readableAssetOptions.some((asset) => asset.assetId === storedAssetId)
    ? storedAssetId
    : readableAssetOptions[0]?.assetId || assetOptionsData[0]?.assetId || Object.keys(ASSET_PAYLOADS)[0];
  const [selectedAssetId, setSelectedAssetId] = useState(defaultAssetId);
  const [modal, setModal] = useState(null);
  const [buildingRegisterSummary, setBuildingRegisterSummary] = useState(null);
  useEffect(() => {
    if (!readableAssetOptions.length) return;
    if (readableAssetOptions.some((asset) => asset.assetId === selectedAssetId)) return;
    const nextAssetId = readableAssetOptions[0]?.assetId;
    if (!nextAssetId) return;
    window.sessionStorage.setItem('logisticsSelectedAssetId', nextAssetId);
    setSelectedAssetId(nextAssetId);
    setBuildingRegisterSummary(null);
  }, [readableAssetOptions, selectedAssetId]);
  const staticRawPayload = ASSET_PAYLOADS[selectedAssetId] || ASSET_PAYLOADS[defaultAssetId] || Object.values(ASSET_PAYLOADS)[0];
  const staticAsset = useMemo(() => normalizeAssetPayload(staticRawPayload || {}), [staticRawPayload]);
  const assetReadAdapter = useMemo(() => (
    (response) => assetPayloadFromDashboardRead(response, staticRawPayload)
  ), [staticRawPayload]);
  const assetRead = useDashboardReadBridge('dashboard/asset/read', { basis_date: DASHBOARD_BASIS_DATE, asset_id: selectedAssetId }, {
    gross_floor_area_sqm: staticAsset.overview?.grossFloorAreaSqm,
    leased_area_sqm: staticAsset.overview?.leasedAreaSqm,
    current_monthly_cost_total: staticAsset.overview?.monthlyCostTotal,
  }, assetReadAdapter, Boolean(selectedAssetId));
  const rawPayload = useMemo(() => (
    assetRead.payload || (assetRead.primaryMode && !assetRead.fallbackAllowed
      ? { overview: {}, rows: [], kpis: [] }
      : staticRawPayload)
  ), [assetRead.fallbackAllowed, assetRead.payload, assetRead.primaryMode, staticRawPayload]);
  const asset = useMemo(() => normalizeAssetPayload(rawPayload || {}), [rawPayload]);
  const overview = asset.overview || {};
  const breakdown = asset.areaBreakdown || {};
  const rows = useMemo(() => asset.normalizedRows || asset.rows || [], [asset.normalizedRows, asset.rows]);
  const stackingFloors = useMemo(() => buildStackingFloorsFromRows(rows, overview.floors || asset.stackingPlan), [rows, overview.floors, asset.stackingPlan]);
  const assetWeightedENoc = calculateWeightedENoc(rows, overview.averageENoc);
  const buildingRegisterSource = rows.find((row) => row.asset?.sigunguCd || row.sigunguCd) || overview;
  const buildingRegisterPayload = buildBuildingRegisterPayload(buildingRegisterSource);
  const buildingRegisterCacheKey = isCompleteBuildingRegisterPayload(buildingRegisterPayload)
    ? `${buildingRegisterPayload.sigungu_cd}|${buildingRegisterPayload.bjdong_cd}|${buildingRegisterPayload.plat_gb_cd}|${buildingRegisterPayload.bun}|${buildingRegisterPayload.ji}`
    : '';
  useEffect(() => {
    if (!buildingRegisterCacheKey) return undefined;
    let cancelled = false;
    const cached = ASSET_BUILDING_REGISTER_CACHE.get(buildingRegisterCacheKey);
    if (cached) {
      setBuildingRegisterSummary(cached);
      return undefined;
    }
    supabase.functions.invoke('ll-dashboard-api', {
      body: { action: 'building-register/summary', payload: buildingRegisterPayload },
    }).then(({ data, error }) => {
      if (cancelled || error || data?.ok === false || !data?.data) return;
      ASSET_BUILDING_REGISTER_CACHE.set(buildingRegisterCacheKey, data.data);
      setBuildingRegisterSummary(data.data);
    }).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [
    buildingRegisterCacheKey,
    buildingRegisterPayload.bjdong_cd,
    buildingRegisterPayload.bun,
    buildingRegisterPayload.ji,
    buildingRegisterPayload.plat_gb_cd,
    buildingRegisterPayload.sigungu_cd,
  ]);
  useEffect(() => {
    const assetNameForPrefetch = overview.assetName;
    const cacheKey = selectedAssetId || normalizeAssetNameKey(assetNameForPrefetch);
    if (!assetNameForPrefetch || !cacheKey) return undefined;
    let cancelled = false;
    if (!ASSET_PROJECT_DETAIL_CACHE.has(cacheKey)) {
      supabase.functions.invoke('ll-dashboard-api', {
        body: {
          action: 'weekly-projects/get-asset-detail',
          payload: { asset_name: assetNameForPrefetch, asset_id: selectedAssetId },
        },
      }).then(({ data }) => {
        if (cancelled || !data?.ok || !data?.data) return;
        ASSET_PROJECT_DETAIL_CACHE.set(cacheKey, {
          overview: Array.isArray(data.data.overview_rows) ? data.data.overview_rows : [],
          investment: Array.isArray(data.data.investment_rows) ? normalizeInvestmentRowsForUi(data.data.investment_rows) : [],
        });
      }).catch(() => {});
    }
    if (!ASSET_FUND_OVERVIEW_CACHE.has(cacheKey)) {
      const fallbackFundRows = buildDefaultFundInfoRows(assetNameForPrefetch, {});
      supabase.functions.invoke('ll-dashboard-api', {
        body: {
          action: 'funds/read-by-asset',
          payload: { asset_name: assetNameForPrefetch, asset_id: selectedAssetId },
        },
      }).then(({ data, error }) => {
        if (cancelled || error || data?.ok === false || !data?.data) return;
        ASSET_FUND_OVERVIEW_CACHE.set(cacheKey, {
          fundInfo: normalizeFundInfoRowsForUi(data.data.fund_info_rows, fallbackFundRows),
          beneficiaries: normalizeFundBeneficiaryRowsForUi(data.data.beneficiary_rows),
          loans: normalizeFundLoanRowsForUi(data.data.loan_rows),
        });
      }).catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [overview.assetName, selectedAssetId]);
  const kpiByKey = kpiLookupFrom(asset.kpis);
  const sourceAssetGrossAreaSqm = Number(firstDefined(
    overview.grossFloorAreaSqm,
    kpiByKey.gross_floor_area_total?.value,
    0,
  ) || 0);
  const assetLeasedAreaBasisSqm = Number(firstDefined(
    overview.leasedAreaSqm,
    kpiByKey.leased_area_total?.value,
    sumRows(rows, (row) => firstDefined(row.leasedAreaSqm, row.currentLeasedAreaSqm)),
    0,
  ) || 0);
  const explicitAssetVacancyAreaSqm = firstDefined(
    overview.vacancyAreaSqm,
    kpiByKey.vacancy_area_total?.value,
  );
  const assetVacancyAreaBasisSqm = explicitAssetVacancyAreaSqm !== undefined && explicitAssetVacancyAreaSqm !== null && explicitAssetVacancyAreaSqm !== ''
    ? Number(explicitAssetVacancyAreaSqm || 0)
    : Math.max(0, sourceAssetGrossAreaSqm - assetLeasedAreaBasisSqm);
  const assetGrossAreaBasisSqm = sourceAssetGrossAreaSqm || (assetLeasedAreaBasisSqm + assetVacancyAreaBasisSqm);
  const assetAreaReconciliationGapSqm = assetGrossAreaBasisSqm - assetLeasedAreaBasisSqm - assetVacancyAreaBasisSqm;
  const assetOccupancyRate = assetGrossAreaBasisSqm > 0 ? assetLeasedAreaBasisSqm / assetGrossAreaBasisSqm : 1 - Number(overview.vacancyRate || 0);
  const assetKpiLabels = {
    gross_floor_area_total: '총 연면적',
    occupancy_rate: '임대율',
    leased_area_total: '총 임대면적',
    vacancy_area_total: '공실면적',
    monthly_total_cost: '월 임관리비 총액',
    average_e_noc: 'E. NOC',
    unique_tenant_count: '현재 임차인 수',
  };
  const assetKpiValueTypes = {
    gross_floor_area_total: 'area',
    occupancy_rate: 'percent',
    leased_area_total: 'area',
    vacancy_area_total: 'area',
    monthly_total_cost: 'currency',
    average_e_noc: 'won',
    unique_tenant_count: 'count',
  };
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
    label: assetKpiLabels[item.key] || item.label,
    valueType: assetKpiValueTypes[item.key] || item.valueType,
    value: item.key === 'average_e_noc'
      ? assetWeightedENoc
      : item.key === 'gross_floor_area_total'
        ? assetGrossAreaBasisSqm
        : item.key === 'occupancy_rate'
          ? assetOccupancyRate
          : item.key === 'leased_area_total'
            ? assetLeasedAreaBasisSqm
            : item.key === 'vacancy_area_total'
              ? assetVacancyAreaBasisSqm
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
              ['RF', formatFavorMonths(firstDefined(source.rfMonths, tenant.rfMonths))],
              ['FO', formatFavorMonths(firstDefined(source.foMonths, tenant.foMonths))],
              ['TI', formatCurrency(firstDefined(source.tiAmount, tenant.tiAmount))],
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
                formatFavorMonths(row.rfMonths),
                formatFavorMonths(row.foMonths),
                formatCurrency(row.tiAmount),
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
  const occupancyGrossAreaSqm = assetLeasedAreaBasisSqm + assetVacancyAreaBasisSqm;
  const areaBasisSqm = occupancyGrossAreaSqm || recomputedGrossAreaSqm || sourceAssetGrossAreaSqm;
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
  const rosterHeaders = ['임차인명', '층/세부구역', '임대면적(평)', '월 임대료', '월 관리비', '월 임관리비', 'E. NOC', 'RF', 'FO', 'TI', '평당 임대료', '평당 관리비', '현재 계약개시일', '현재 계약만기일'];
  const rosterColumnWidths = ['13%', '7.5%', '8%', '7.5%', '7.2%', '7.8%', '6.6%', '4.2%', '4.2%', '5.2%', '7%', '6.8%', '6.4%', '6.6%'];
  const rosterRows = rows.map((row) => [
    row.tenantMasterName,
    row.spaceLabel,
    formatArea(row.leasedAreaSqm),
    formatCurrency(row.monthlyRentTotal),
    formatCurrency(row.monthlyMfTotal),
    formatCurrency(row.monthlyCombinedTotal),
    formatWon(firstDefined(row.eNoc, row.averageENoc, row.currentENoc, row.currentENocPerPy)),
    formatFavorMonths(row.rfMonths),
    formatFavorMonths(row.foMonths),
    formatCurrency(row.tiAmount),
    formatWon(row.currentRentPerPy),
    formatWon(row.currentMfPerPy),
    formatDate(row.currentStartDate),
    formatDate(row.currentEndDate),
  ]);
  const effectiveExpirySourceRows = sortExpiryRows(asset.expiryRows && asset.expiryRows.length
    ? asset.expiryRows
    : buildExpiryRowsFromRows(rows));
  const expiryRows = effectiveExpirySourceRows.map((row) => [
    row.tenantMasterName || '-',
    row.spaceLabel || row.detailAreaLabel || row.floorLabel || '-',
    formatDate(firstDefined(row.currentEndDate, row.earliestExpiry, row.latestExpiry)),
    formatNumber(row.monthsToExpiry),
    formatCurrency(firstDefined(row.monthlyCostTotal, row.monthlyCombinedTotal)),
  ]);
  const expiryChartRows = effectiveExpirySourceRows.map((row) => {
    const zone = formatFloorZoneLabel(row.spaceLabel || row.detailAreaLabel || row.floorLabel || '-');
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
  const monthlyCostTotalForShare = Number(firstDefined(
    overview.monthlyCostTotal,
    kpis.find((item) => item.key === 'monthly_total_cost')?.value,
    sumRows(asset.monthlyCostByTenant || [], (row) => firstDefined(row.monthlyCostTotal, row.monthlyCombinedTotal)),
    0,
  ) || 0);
  const monthlyCostChartRows = (asset.monthlyCostByTenant || []).map((row) => {
    const monthlyCost = Number(firstDefined(row.monthlyCostTotal, row.monthlyCombinedTotal, 0) || 0);
    const share = monthlyCostTotalForShare > 0 ? monthlyCost / monthlyCostTotalForShare : 0;
    return {
      ...row,
      monthlyCostTotal: monthlyCost,
      monthlyCostShare: share,
      displayValue: `${formatCurrency(monthlyCost)} (${formatPercent(share)})`,
      tooltipLines: [
        ['전체 월 임관리비 중 비율', formatPercent(share)],
        ['월 임관리비', formatCurrency(monthlyCost)],
        ['임대면적', formatArea(row.leasedAreaSqm)],
      ],
    };
  });

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
              setBuildingRegisterSummary(null);
            }} className="h-10 min-w-[280px] rounded-[8px] border border-[#3A3A3C] bg-[#1F1F1E] px-3 text-[13px] text-white">
              {readableAssetOptions.map((item) => <option key={item.assetId} value={item.assetId}>{item.assetName}</option>)}
            </select>
            <button type="button" onClick={() => (mapPoint.length ? setModal({ title: '포트폴리오 위치', content: <div className="space-y-4"><PortfolioMapPlot points={mapPoint} /><DataTable headers={['자산명', '주소', '좌표']} rows={[[overview.assetName, overview.standardizedAddress || '-', `${overview.latitude}, ${overview.longitude}`]]} compact /></div> }) : openTableModal('자산 위치 정보', ['항목', '내용'], [['자산명', overview.assetName || '-'], ['주소', overview.standardizedAddress || '-'], ['좌표', '미입력']]))} className="h-10 px-3 rounded-[8px] bg-white text-[#1F1F1E] text-[13px] font-semibold hover:bg-[#E5E5E5]">자산 위치 보기</button>
          </div>
        </div>
      </section>

      {assetRead.blocked ? (
        <DashboardAccessState title="Dashboard read blocked" message="Supabase read API가 현재 로그인 사용자의 선택 자산 읽기 권한을 허용하지 않아 정적 JSON fallback을 차단했습니다." />
      ) : null}

      <section className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
        <SectionHeader
          eyebrow="WEEKLY MANAGEMENT PROJECT"
          title="자산개요 · 투자개요 · 펀드개요"
          right={(
            <button
              type="button"
              onClick={() => setModal({
                title: `자산개요 · 투자개요 · 펀드개요 · ${overview.assetName || ''}`,
                size: 'fullscreen',
                content: <AssetProjectInfoPanel assetName={overview.assetName} modalMode buildingRegisterSummary={buildingRegisterSummary} />,
              })}
              className={`h-9 rounded-[8px] border px-3 text-[13px] font-semibold ${PRIMARY_BLUE_BUTTON_CLASS}`}
            >
              전체 화면 보기
            </button>
          )}
        />
        <p className="text-[13px] leading-6 text-[#A1A1AA]">
          자산개요, 투자개요, 펀드개요는 전체 화면 팝업에서 확인하고 수정합니다.
        </p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-7 gap-3">
        {kpis.map((item) => (
          <button key={item.key || item.label} type="button" onClick={() => {
            if (item.key === 'average_e_noc') {
              openENocAudit();
              return;
            }
            openTableModal(item.label, ['항목', '내용'], [['값', formatMetric(item.value, item.valueType)], ['자산', overview.assetName || '-'], ['연면적-임대면적-공실면적 차이', formatSignedArea(assetAreaReconciliationGapSqm)], ['상태', item.status || '-']]);
          }} className="text-left rounded-[14px] border border-[#333333] bg-[#252524] px-4 py-4 hover:bg-[#2A2A29]">
            <div className="text-[12px] text-[#86868B] font-semibold">{item.label}</div>
            <div className="text-[22px] text-white font-semibold mt-2">{item.key === 'monthly_total_cost' && item.value != null ? `${formatDecimalNumber(Number(item.value) / 100000000, 1)}억` : formatMetric(item.value, item.valueType)}</div>
          </button>
        ))}
      </section>

      <section className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
        <SectionHeader eyebrow="TENANTS" title="임차인 현황" />
        <DataTable
          headers={rosterHeaders}
          rows={rosterRows}
          onRowClick={(index) => openTenantDetail(rows[index], '임차인 상세')}
          columnWidths={rosterColumnWidths}
          minTableWidth="1120px"
          compact
          tight
        />
      </section>

      <section className="grid grid-cols-1 gap-5">
        <div className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
          <SectionHeader eyebrow="RENT" title="임차인별 월 임관리비" right={<button type="button" onClick={() => openTableModal('임차인별 월 임관리비', monthlyCostHeaders, monthlyCostRows)} className="h-9 px-3 rounded-[8px] bg-[#30302F] text-white text-[13px] font-semibold hover:bg-[#3A3A3A]">상세 보기</button>} />
          <RichBarChart rows={monthlyCostChartRows} labelKey="tenantMasterName" valueKey="monthlyCostTotal" barValueKey="monthlyCostShare" barMaxValue={1} valueType="currency" valueLabel="임차인별 월 임관리비" showXAxisLabels={false} onClick={() => openTableModal('임차인별 월 임관리비', monthlyCostHeaders, monthlyCostRows)} />
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
          <SectionHeader eyebrow="STACKING" title="층별 배치" />
          <StackingPlan floors={stackingFloors} onTenantClick={(tenant) => openTenantDetail(tenant, '임차인 상세')} />
        </div>
        <div className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
          <SectionHeader eyebrow="AREA" title="면적 구성" />
          <DataTable headers={['항목', '면적(평)', '비율']} rows={areaRows} compact />
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
          <SectionHeader eyebrow="EXPIRY" title="만기 스냅샷" right={<button type="button" onClick={() => openTableModal('만기 스냅샷', ['임차인명', '세부 구역', '계약만기일', '잔여 개월', '월 임관리비'], expiryRows)} className="h-9 px-3 rounded-[8px] bg-[#30302F] text-white text-[13px] font-semibold hover:bg-[#3A3A3A]">원본 표 보기</button>} />
          <RichBarChart rows={expiryChartRows} labelKey="expiryChartLabel" valueKey="monthsToExpiry" valueType="number" valueLabel="계약만기까지 잔여 개월" maxRows={Infinity} includeZero showXAxisLabels={false} onClick={() => openTableModal('만기 스냅샷', ['임차인명', '세부 구역', '계약만기일', '잔여 개월', '월 임관리비'], expiryRows)} />
        </div>
      </section>
    </div>
  );
}

function PdfReportBuilder() {
  const { memberInfo } = useAuth();
  const permission = useMemo(() => resolveLogisticsPermission(memberInfo), [memberInfo]);
  const canUseAdvancedTools = canViewAdvancedLogisticsTools(memberInfo, permission);
  const { rows: latestWeeklyAssetRows } = useLatestWeeklyAssetRows(permission, memberInfo);
  const dashboardDataset = useDashboardHomeReadDataset(memberInfo);
  const readableAssets = useMemo(() => filterAssetsByPermission(dashboardDataset.assetOptions, permission), [dashboardDataset.assetOptions, permission]);
  const sourceRows = useMemo(() => filterAssetsByPermission(dashboardDataset.generalRows, permission), [dashboardDataset.generalRows, permission]);
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [selectedComponentIds, setSelectedComponentIds] = useState(['kpi', 'overview', 'tenant', 'contracts', 'map']);
  const [draggingComponentId, setDraggingComponentId] = useState(null);
  const printScopeRef = useRef(null);

  const componentOptions = useMemo(() => [
    { id: 'homeKpi', label: 'Dashboard Home KPI' },
    { id: 'portfolioLocation', label: '포트폴리오 위치' },
    { id: 'useRatio', label: '용도별 비율' },
    { id: 'monthlyCostShare', label: '월 임관리비 비중' },
    { id: 'rentTrend', label: '계약 이력 기준 임대료 추이' },
    { id: 'regionExposure', label: '권역별 노출도' },
    { id: 'homeMaturity', label: 'Home 만기 집중도' },
    { id: 'tenantContracts', label: '임차인 계약' },
    { id: 'kpi', label: 'Asset 핵심 KPI' },
    { id: 'overview', label: 'Asset 자산개요·투자개요·펀드개요' },
    { id: 'tenant', label: 'Asset 임차인 현황' },
    { id: 'assetArea', label: 'Asset 면적 구성' },
    { id: 'assetStacking', label: 'Asset 층별 배치' },
    { id: 'contracts', label: 'Asset 계약 원장' },
    { id: 'maturity', label: 'Asset 만기 스냅샷' },
    { id: 'map', label: 'Asset 위치 지도' },
    { id: 'companyExposure', label: 'Company 자산별 노출도' },
    { id: 'analysisAsset', label: 'Analysis 자산 비교', adminOnly: true },
    { id: 'analysisCompany', label: 'Analysis 기업 비교', adminOnly: true },
    { id: 'pivotTable', label: 'Pivot Table 결과', adminOnly: true },
    { id: 'dataQuality', label: 'Data Quality 이슈', adminOnly: true },
  ].filter((option) => !option.adminOnly || canUseAdvancedTools), [canUseAdvancedTools]);
  const allowedComponentIds = useMemo(() => new Set(componentOptions.map((option) => option.id)), [componentOptions]);
  const activeComponentIds = useMemo(() => {
    const filtered = selectedComponentIds.filter((id) => allowedComponentIds.has(id));
    return filtered.length ? filtered : componentOptions.slice(0, 4).map((option) => option.id);
  }, [allowedComponentIds, componentOptions, selectedComponentIds]);
  const componentOptionMap = useMemo(() => new Map(componentOptions.map((option) => [option.id, option])), [componentOptions]);
  const selectedComponentOptions = useMemo(() => activeComponentIds.map((id) => componentOptionMap.get(id)).filter(Boolean), [activeComponentIds, componentOptionMap]);
  const unselectedComponentOptions = useMemo(() => componentOptions.filter((option) => !activeComponentIds.includes(option.id)), [activeComponentIds, componentOptions]);
  const orderedComponentOptions = useMemo(() => [...selectedComponentOptions, ...unselectedComponentOptions], [selectedComponentOptions, unselectedComponentOptions]);
  const selectedAsset = readableAssets.find((asset) => asset.assetId === selectedAssetId) || readableAssets[0] || {};
  const staticAssetPayload = useMemo(() => (
    findAssetPayload(selectedAsset.assetId, selectedAsset.assetName)
  ), [selectedAsset.assetId, selectedAsset.assetName]);
  const pdfAssetReadAdapter = useMemo(() => (
    (response) => assetPayloadFromDashboardRead(response, findAssetPayload(selectedAsset.assetId, selectedAsset.assetName))
  ), [selectedAsset.assetId, selectedAsset.assetName]);
  const pdfAssetRead = useDashboardReadBridge('dashboard/asset/read', { basis_date: DASHBOARD_BASIS_DATE, asset_id: selectedAsset.assetId }, {
    gross_floor_area_sqm: firstDefined(selectedAsset.grossFloorAreaSqm, staticAssetPayload?.overview?.grossFloorAreaSqm),
    current_monthly_cost_total: firstDefined(selectedAsset.monthlyCostTotal, staticAssetPayload?.overview?.monthlyCostTotal),
  }, pdfAssetReadAdapter, Boolean(selectedAsset.assetId));
  const assetPayload = pdfAssetRead.payload || (pdfAssetRead.primaryMode && !pdfAssetRead.fallbackAllowed
    ? { overview: selectedAsset, rows: [] }
    : staticAssetPayload);
  const assetRows = (assetPayload?.rows || []).length
    ? assetPayload.rows
    : sourceRows.filter((row) => row.assetId === selectedAsset.assetId || resolveAssetIdByName(row.assetName) === selectedAsset.assetId);
  const overview = assetPayload?.overview || selectedAsset || {};
  const tenantGroups = buildTenantContractGroups(assetRows);
  const selectedAssetProject = findManagementProjectForAsset(selectedAsset.assetName);
  const [pdfFundRows, setPdfFundRows] = useState(null);
  const [pdfFundReadState, setPdfFundReadState] = useState({ key: '', mode: 'idle' });
  const weeklyAssetRowsForSource = useMemo(() => (
    latestWeeklyAssetRows.length ? latestWeeklyAssetRows : normalizeWeeklyAssetRows(weeklyReportData.assetRows || [])
  ), [latestWeeklyAssetRows]);
  const selectedWeeklyAssetRow = weeklyAssetRowsForSource
    .find((row) => normalizeAssetNameKey(row.assetName) === normalizeAssetNameKey(selectedAsset.assetName));
  const fallbackPdfFundInfoRows = buildDefaultFundInfoRows(selectedAsset.assetName, selectedWeeklyAssetRow || {});
  const fallbackPdfFundInfoRowsKey = JSON.stringify(fallbackPdfFundInfoRows);
  const selectedAssetKey = `${selectedAsset.assetId || ''}|${selectedAsset.assetName || ''}`;
  useEffect(() => {
    let cancelled = false;
    if (!selectedAsset.assetId && !selectedAsset.assetName) return undefined;
    supabase.functions.invoke('ll-dashboard-api', {
      body: {
        action: 'funds/read-by-asset',
        payload: { asset_id: selectedAsset.assetId, asset_name: selectedAsset.assetName },
      },
    }).then(({ data, error }) => {
      if (error) throw error;
      if (cancelled) return;
      if (data?.ok === false) {
        const status = Number(data?.status || data?.status_code || 0);
        const message = data?.message || data?.error || '';
        if (isAuthOrPermissionFailure(status, message)) {
          setPdfFundRows({
            assetId: selectedAsset.assetId,
            assetName: selectedAsset.assetName,
            fundInfo: [],
            beneficiaries: [],
            loans: [],
            blockedMessage: '펀드개요는 해당 자산 읽기 권한이 확인된 경우에만 PDF에 포함됩니다.',
          });
          setPdfFundReadState({ key: selectedAssetKey, mode: 'blocked' });
        } else {
          setPdfFundReadState({ key: selectedAssetKey, mode: 'fallback' });
        }
        return;
      }
      if (!data?.data) return;
      const fallbackRows = JSON.parse(fallbackPdfFundInfoRowsKey || '[]');
      setPdfFundRows({
        assetId: selectedAsset.assetId,
        assetName: selectedAsset.assetName,
        fundInfo: normalizeFundInfoRowsForUi(data.data.fund_info_rows, fallbackRows),
        beneficiaries: normalizeFundBeneficiaryRowsForUi(data.data.beneficiary_rows),
        loans: normalizeFundLoanRowsForUi(data.data.loan_rows),
      });
      setPdfFundReadState({ key: selectedAssetKey, mode: 'allowed' });
    }).catch((error) => {
      if (!cancelled) {
        const status = edgeErrorStatus(error);
        const message = error?.message || error?.context?.statusText || '';
        if (isAuthOrPermissionFailure(status, message)) {
          setPdfFundRows({
            assetId: selectedAsset.assetId,
            assetName: selectedAsset.assetName,
            fundInfo: [],
            beneficiaries: [],
            loans: [],
            blockedMessage: '펀드개요는 해당 자산 읽기 권한이 확인된 경우에만 PDF에 포함됩니다.',
          });
          setPdfFundReadState({ key: selectedAssetKey, mode: 'blocked' });
        } else {
          setPdfFundReadState({ key: selectedAssetKey, mode: 'fallback' });
          setPdfFundRows(null);
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [fallbackPdfFundInfoRowsKey, selectedAsset.assetId, selectedAsset.assetName, selectedAssetKey]);
  const grossAreaSqm = firstDefined(overview.grossFloorAreaSqm, selectedAsset.grossFloorAreaSqm, assetRows[0]?.grossFloorAreaSqm);
  const leasedAreaSqm = assetRows.reduce((sum, row) => sum + Number(row.leasedAreaSqm || 0), 0);
  const monthlyCostTotal = assetRows.reduce((sum, row) => sum + Number(row.monthlyCostTotal || row.currentMonthlyRentTotal || 0) + (row.monthlyCostTotal ? 0 : Number(row.currentMonthlyMfTotal || 0)), 0);
  const weightedENoc = calculateWeightedENoc(assetRows, overview.averageENoc);
  const selectedPdfFundRows = pdfFundRows?.assetId === selectedAsset.assetId ? pdfFundRows : null;
  const currentPdfFundMode = pdfFundReadState.key === selectedAssetKey ? pdfFundReadState.mode : selectedAssetKey ? 'loading' : 'idle';
  const pdfFundInfoRowsForOutput = selectedPdfFundRows?.blockedMessage
    ? [['펀드개요', '조회 제한', selectedPdfFundRows.blockedMessage]]
    : currentPdfFundMode === 'loading'
      ? fallbackPdfFundInfoRows.map((row) => ['펀드개요', row[1], row[2]])
      : (selectedPdfFundRows?.fundInfo?.length ? selectedPdfFundRows.fundInfo : fallbackPdfFundInfoRows).map((row) => ['펀드개요', row[1], row[2]]);
  const pdfBeneficiaryRowsForOutput = selectedPdfFundRows && !selectedPdfFundRows.blockedMessage ? selectedPdfFundRows.beneficiaries || [] : [];
  const pdfLoanRowsForOutput = selectedPdfFundRows && !selectedPdfFundRows.blockedMessage ? selectedPdfFundRows.loans || [] : [];
  const kpiRows = [
    ['자산명', selectedAsset.assetName || '-'],
    ['총 연면적', formatArea(grossAreaSqm)],
    ['총 임대면적', formatArea(leasedAreaSqm)],
    ['월 임관리비', formatCurrency(monthlyCostTotal)],
    ['E. NOC', formatWon(weightedENoc)],
    ['현재 임차인 수', `${formatNumber(tenantGroups.length)}개`],
  ];
  const overviewRows = [
    ...buildAssetOverviewRows(selectedAsset.assetName, selectedAssetProject, selectedWeeklyAssetRow || {}),
    ...buildAssetInvestmentRows(selectedAssetProject, selectedWeeklyAssetRow || {}),
    ...pdfFundInfoRowsForOutput,
    ...pdfBeneficiaryRowsForOutput.map((row) => ['수익자 정보', row.tranche || '-', [row.beneficiary_name, row.committed_amount_krw ? formatWon(row.committed_amount_krw) : ''].filter(Boolean).join(' / ')]),
    ...pdfLoanRowsForOutput.map((row) => ['대주 정보', row.tranche || '-', [
      row.loan_type,
      row.lender_name,
      row.committed_amount_krw ? formatWon(row.committed_amount_krw) : '',
      row.drawdown_date,
      row.maturity_date,
      row.interest_type,
      row.base_rate,
      row.spread_rate,
      row.loan_rate || row.interest_rate,
      row.fee_rate || row.fee,
      row.all_in_rate || row.all_in,
    ].filter(Boolean).join(' / ')]),
  ];
  const tenantRows = tenantGroups.slice(0, 12).map((row) => [
    row.tenantMasterName,
    row.assetNames?.join('\n') || selectedAsset.assetName,
    formatNumber(row.rowCount),
    formatArea(row.leasedAreaSqm),
    formatCurrency(row.monthlyRentTotal),
    formatCurrency(row.monthlyMfTotal),
    formatCurrency(row.monthlyCostTotal),
    formatWon(row.costPerPy),
  ]);
  const contractRows = assetRows.slice(0, 80).map((row) => [
    row.tenantMasterName,
    row.floorLabel || row.spaceLabel || '-',
    row.detailAreaLabel || '-',
    row.coldStorageType || '-',
    formatArea(row.leasedAreaSqm),
    formatCurrency(row.currentMonthlyRentTotal),
    formatCurrency(row.currentMonthlyMfTotal),
    formatCurrency(row.monthlyCostTotal),
    row.currentEndDate || '-',
  ]);
  const maturityRows = assetRows
    .filter((row) => row.currentEndDate)
    .sort((a, b) => String(a.currentEndDate).localeCompare(String(b.currentEndDate)))
    .slice(0, 20)
    .map((row) => [
      row.tenantMasterName,
      [row.floorLabel, row.detailAreaLabel].filter(Boolean).join(' / ') || '-',
      row.currentEndDate,
      formatArea(row.leasedAreaSqm),
      formatCurrency(row.monthlyCostTotal),
    ]);
  const portfolioRows = readableAssets.slice(0, 30).map((asset) => [
    asset.assetName,
    asset.standardizedAddress || asset.address || '-',
    formatArea(asset.grossFloorAreaSqm),
    formatCurrency(asset.monthlyCostTotal),
    formatWon(asset.averageENoc),
  ]);
  const useRows = [
    ['상온창고', formatArea(overview.areaBreakdown?.ambientWarehouseAreaSqm || overview.ambientWarehouseAreaSqm)],
    ['저온창고', formatArea(overview.areaBreakdown?.coldWarehouseAreaSqm || overview.coldWarehouseAreaSqm)],
    ['복합', formatArea(overview.areaBreakdown?.mixedUseAreaSqm || overview.mixedUseAreaSqm)],
    ['사무실', formatArea(overview.areaBreakdown?.officeAreaSqm || overview.officeAreaSqm)],
  ];
  const regionRows = readableAssets.slice(0, 30).map((asset) => [
    deriveLogisticsRegionFromAddress(asset.standardizedAddress || asset.address, '미분류'),
    asset.assetName,
    formatArea(asset.grossFloorAreaSqm),
    formatCurrency(asset.monthlyCostTotal),
  ]);
  const stackingRows = assetRows.slice(0, 30).map((row) => [
    row.floorLabel || '-',
    row.detailAreaLabel || row.spaceLabel || '-',
    row.tenantMasterName || '-',
    formatArea(row.leasedAreaSqm),
  ]);
  const qualityRows = [
    ['자산개요·투자개요', 'll_weekly_records(project) 저장 및 readback 기준'],
    ['자산현황', 'll_weekly_records(asset) 저장 및 readback 기준'],
    ['계약 원장', 'll_lease_spaces / ll_rent_history 기준'],
    ['외부 API', 'OpenDART·건축물대장·Naver는 Edge Function 기준'],
  ];
  const mapLatitude = firstDefined(selectedAsset.latitude, overview.latitude, assetPayload?.overview?.latitude);
  const mapLongitude = firstDefined(selectedAsset.longitude, overview.longitude, assetPayload?.overview?.longitude);
  const mapPoint = mapLatitude && mapLongitude ? [{
    assetId: selectedAsset.assetId,
    assetName: selectedAsset.assetName,
    address: firstDefined(selectedAsset.standardizedAddress, selectedAsset.address, overview.standardizedAddress, overview.address),
    latitude: mapLatitude,
    longitude: mapLongitude,
  }] : [];
  const renderComponent = (id) => {
    if (id === 'homeKpi') return <ReportPreviewCard title="Dashboard Home KPI"><DataTable headers={['항목', '값']} rows={[['운영 자산 수', `${formatNumber(readableAssets.length)}개`], ['총 연면적', formatArea(readableAssets.reduce((sum, asset) => sum + Number(asset.grossFloorAreaSqm || 0), 0))], ['월 임관리비 총액', formatCurrency(readableAssets.reduce((sum, asset) => sum + Number(asset.monthlyCostTotal || 0), 0))]]} compact /></ReportPreviewCard>;
    if (id === 'portfolioLocation') return <ReportPreviewCard title="포트폴리오 위치"><DataTable headers={['자산명', '주소', '연면적(평)', '월 임관리비', 'E. NOC']} rows={portfolioRows} compact /></ReportPreviewCard>;
    if (id === 'useRatio') return <ReportPreviewCard title="용도별 비율"><DataTable headers={['구분', '면적']} rows={useRows} compact /></ReportPreviewCard>;
    if (id === 'monthlyCostShare') return <ReportPreviewCard title="월 임관리비 비중"><DataTable headers={['임차인', '자산', '계약 수', '임대면적', '월 임관리비', 'E. NOC']} rows={tenantRows.map((row) => [row[0], row[1], row[2], row[3], row[6], row[7]])} compact /></ReportPreviewCard>;
    if (id === 'rentTrend') return <ReportPreviewCard title="계약 이력 기준 임대료 추이"><DataTable headers={['항목', '값']} rows={[['선택 자산', selectedAsset.assetName || '-'], ['월 임관리비', formatCurrency(monthlyCostTotal)], ['연면적', formatArea(grossAreaSqm)], ['자산 수', `${formatNumber(readableAssets.length)}개`]]} compact /></ReportPreviewCard>;
    if (id === 'regionExposure') return <ReportPreviewCard title="권역별 노출도"><DataTable headers={['권역', '자산명', '연면적', '월 임관리비']} rows={regionRows} compact /></ReportPreviewCard>;
    if (id === 'homeMaturity') return <ReportPreviewCard title="Home 만기 집중도"><DataTable headers={['임차인', '구역', '만기일', '임대면적', '월 임관리비']} rows={maturityRows} compact /></ReportPreviewCard>;
    if (id === 'tenantContracts') return <ReportPreviewCard title="임차인 계약"><DataTable headers={['임차인', '자산', '계약 수', '임대면적', '월 임대료', '월 관리비', '월 임관리비', 'E. NOC']} rows={tenantRows} compact /></ReportPreviewCard>;
    if (id === 'kpi') return <ReportPreviewCard title="Asset 핵심 KPI"><DataTable headers={['항목', '값']} rows={kpiRows} compact /></ReportPreviewCard>;
    if (id === 'overview') return <ReportPreviewCard title="자산개요·투자개요·펀드개요"><DataTable headers={['구분', '항목', '내용']} rows={overviewRows} compact /></ReportPreviewCard>;
    if (id === 'tenant') return <ReportPreviewCard title="임차인 노출도"><DataTable headers={['임차인', '자산', '계약 수', '임대면적', '월 임대료', '월 관리비', '월 임관리비', 'E. NOC']} rows={tenantRows} compact /></ReportPreviewCard>;
    if (id === 'assetArea') return <ReportPreviewCard title="면적 구성"><DataTable headers={['구분', '면적']} rows={useRows} compact /></ReportPreviewCard>;
    if (id === 'assetStacking') return <ReportPreviewCard title="층별 배치"><DataTable headers={['층', '세부구역', '임차인', '임대면적']} rows={stackingRows} compact /></ReportPreviewCard>;
    if (id === 'contracts') return <ReportPreviewCard title="계약 원장"><DataTable headers={['임차인', '층', '세부구역', '저온/상온', '임대면적', '월 임대료', '월 관리비', '월 임관리비', '만기']} rows={contractRows} compact /></ReportPreviewCard>;
    if (id === 'maturity') return <ReportPreviewCard title="만기 스냅샷"><DataTable headers={['임차인', '구역', '만기일', '임대면적', '월 임관리비']} rows={maturityRows} compact /></ReportPreviewCard>;
    if (id === 'map') return <ReportPreviewCard title="자산 위치 지도">{mapPoint.length ? <PrintableAssetMap point={mapPoint[0]} /> : <div className="rounded-[12px] border border-[#333333] bg-[#1F1F1E] p-4 text-[13px] text-[#A1A1AA]">좌표 데이터가 없습니다.</div>}</ReportPreviewCard>;
    if (id === 'companyExposure') return <ReportPreviewCard title="Company 자산별 노출도"><DataTable headers={['기업/임차인', '자산', '계약 수', '임대면적', '월 임관리비']} rows={tenantRows.map((row) => [row[0], row[1], row[2], row[3], row[6]])} compact /></ReportPreviewCard>;
    if (id === 'analysisAsset') return <ReportPreviewCard title="Analysis 자산 비교"><DataTable headers={['자산명', '연면적', '월 임관리비', 'E. NOC']} rows={portfolioRows.map((row) => [row[0], row[2], row[3], row[4]])} compact /></ReportPreviewCard>;
    if (id === 'analysisCompany') return <ReportPreviewCard title="Analysis 기업 비교"><DataTable headers={['임차인', '자산', '계약 수', '임대면적', '월 임관리비']} rows={tenantRows.map((row) => [row[0], row[1], row[2], row[3], row[6]])} compact /></ReportPreviewCard>;
    if (id === 'pivotTable') return <ReportPreviewCard title="Pivot Table 결과"><DataTable headers={['차원', '값', '비고']} rows={tenantRows.slice(0, 12).map((row) => [row[0], row[6], row[1]])} compact /></ReportPreviewCard>;
    if (id === 'dataQuality') return <ReportPreviewCard title="Data Quality 이슈"><DataTable headers={['영역', '기준']} rows={qualityRows} compact /></ReportPreviewCard>;
    return null;
  };
  const moveComponent = (id, direction) => {
    setSelectedComponentIds((current) => {
      const basis = current.filter((item) => allowedComponentIds.has(item));
      const next = basis.length ? [...basis] : [...activeComponentIds];
      const index = next.indexOf(id);
      const nextIndex = direction === 'up' ? index - 1 : index + 1;
      if (index < 0 || nextIndex < 0 || nextIndex >= next.length) return current;
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  };
  const reorderComponent = (fromId, toId) => {
    if (!fromId || !toId || fromId === toId) return;
    setSelectedComponentIds((current) => {
      const basis = current.filter((item) => allowedComponentIds.has(item));
      const next = basis.length ? [...basis] : [...activeComponentIds];
      const fromIndex = next.indexOf(fromId);
      const toIndex = next.indexOf(toId);
      if (fromIndex < 0 || toIndex < 0) return current;
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };
  const toggleComponent = (optionId, checked) => {
    setSelectedComponentIds((current) => {
      const basis = current.filter((id) => allowedComponentIds.has(id));
      const next = basis.length ? basis : activeComponentIds;
      if (checked) return next.includes(optionId) ? next : [...next, optionId];
      return next.filter((id) => id !== optionId);
    });
  };
  const printPdfReport = () => {
    const printNode = printScopeRef.current;
    if (!printNode || typeof window === 'undefined') {
      window.print();
      return;
    }
    const stylesheetLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .map((link) => `<link rel="stylesheet" href="${link.href}">`)
      .join('');
    const inlineStyles = Array.from(document.querySelectorAll('style'))
      .map((style) => `<style>${style.textContent || ''}</style>`)
      .join('');
    const printWindow = window.open('', '_blank', 'width=1100,height=900');
    if (!printWindow) {
      window.print();
      return;
    }
    printWindow.document.open();
    printWindow.document.write(`<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(selectedAsset.assetName || 'PDF Report')}</title>
  ${stylesheetLinks}
  ${inlineStyles}
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    html, body { width: 100%; min-height: 100%; margin: 0; background: #fff !important; color: #111 !important; font-family: Inter, Arial, sans-serif; overflow: visible !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { padding: 0; }
    .pdf-print-scope { width: 100% !important; max-width: none !important; margin: 0 !important; padding: 0 !important; display: block !important; background: #fff !important; color: #111 !important; }
    .pdf-print-scope > * + * { margin-top: 12px !important; }
    .pdf-report-card, .pdf-print-scope > div { break-inside: auto !important; page-break-inside: auto !important; background: #fff !important; border: 1px solid #d9d9d9 !important; color: #111 !important; box-shadow: none !important; }
    .pdf-report-card * { color: #111 !important; }
    .pdf-report-card table { width: 100% !important; min-width: 100% !important; table-layout: fixed !important; border-collapse: collapse !important; font-size: 10px !important; }
    .pdf-report-card thead { display: table-header-group !important; }
    .pdf-report-card tr { break-inside: avoid !important; page-break-inside: avoid !important; }
    .pdf-report-card th { background: #eeeeee !important; color: #111 !important; }
    .pdf-report-card th, .pdf-report-card td { border-color: #d9d9d9 !important; color: #111 !important; white-space: normal !important; overflow: visible !important; text-overflow: clip !important; word-break: keep-all !important; overflow-wrap: anywhere !important; }
    .pdf-report-card .custom-scrollbar, .pdf-report-card [class*="overflow"] { overflow: visible !important; max-height: none !important; height: auto !important; }
    .pdf-map-screen { display: none !important; }
    .pdf-static-map-print { display: block !important; break-inside: avoid !important; page-break-inside: avoid !important; }
    .pdf-static-map-print img { max-width: none !important; }
    .pdf-static-map-print [role="img"] { max-height: 145mm !important; }
  </style>
</head>
<body>
  ${printNode.outerHTML}
  <script>
    window.addEventListener('load', function () {
      var done = false;
      function finish() {
        if (done) return;
        done = true;
        setTimeout(function () { window.focus(); window.print(); }, 180);
      }
      var images = Array.prototype.slice.call(document.images || []);
      var pending = images.filter(function (img) { return !img.complete; });
      if (!pending.length) {
        finish();
        return;
      }
      var remaining = pending.length;
      pending.forEach(function (img) {
        var resolve = function () {
          remaining -= 1;
          if (remaining <= 0) finish();
        };
        img.addEventListener('load', resolve, { once: true });
        img.addEventListener('error', resolve, { once: true });
      });
      setTimeout(finish, 3200);
    });
  </script>
</body>
</html>`);
    printWindow.document.close();
  };

  return (
    <div className="w-full max-w-[1480px] mx-auto px-8 pt-8 pb-14">
      <style>{`
        @page { size: A4 portrait; margin: 12mm; }
        .pdf-static-map-print { display: block; }
        @media print {
          html, body, #root { background: #fff !important; color: #000 !important; width: 100% !important; overflow: visible !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body * { visibility: hidden !important; }
          .pdf-print-scope, .pdf-print-scope * { visibility: visible !important; }
          .pdf-print-scope { position: absolute !important; inset: 0 auto auto 0 !important; width: 100% !important; max-width: none !important; margin: 0 !important; padding: 0 !important; background: #fff !important; color: #000 !important; }
          .pdf-report-controls, .pdf-report-sidebar { display: none !important; visibility: hidden !important; }
          .pdf-report-page { max-width: none !important; padding: 0 !important; color: #000 !important; }
          .pdf-report-layout { display: block !important; }
          .pdf-report-card { break-inside: auto !important; page-break-inside: auto !important; background: #fff !important; border-color: #d6d6d6 !important; color: #000 !important; }
          .pdf-report-card * { color: #000 !important; }
          .pdf-report-card table { width: 100% !important; min-width: 100% !important; table-layout: fixed !important; }
          .pdf-report-card thead { display: table-header-group !important; }
          .pdf-report-card tr { break-inside: avoid !important; page-break-inside: avoid !important; }
          .pdf-report-card th, .pdf-report-card td { white-space: normal !important; overflow: visible !important; text-overflow: clip !important; word-break: keep-all !important; overflow-wrap: anywhere !important; }
          .pdf-report-card .custom-scrollbar, .pdf-report-card [class*="overflow"] { overflow: visible !important; max-height: none !important; height: auto !important; }
          .pdf-report-card thead { background: #eeeeee !important; }
          .pdf-map-screen { display: none !important; }
          .pdf-static-map-print { display: block !important; break-inside: avoid !important; page-break-inside: avoid !important; }
          .pdf-static-map-print img { max-width: none !important; }
          .pdf-static-map-print [role="img"] { max-height: 145mm !important; }
        }
      `}</style>
      <div className="pdf-report-page space-y-5">
        <SectionHeader
          title="PDF Report"
          right={<button type="button" onClick={printPdfReport} className="pdf-report-controls h-9 rounded-[8px] bg-white px-4 text-[13px] font-bold text-[#1F1F1E] hover:bg-[#E5E5E5]">PDF 저장</button>}
        />
        {dashboardDataset.blocked ? (
          <DashboardAccessState title="Dashboard read blocked" message="Supabase read API가 현재 로그인 사용자의 PDF Report 데이터 읽기 권한을 허용하지 않아 정적 JSON fallback을 차단했습니다." />
        ) : null}
        <section className="pdf-report-layout grid grid-cols-1 gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="pdf-report-sidebar rounded-[20px] border border-[#333333] bg-[#252524] p-5">
            <label className="block text-[12px] font-bold text-[#86868B]">자산 선택</label>
            <select value={selectedAsset.assetId || ''} onChange={(event) => setSelectedAssetId(event.target.value)} className="mt-2 h-11 w-full rounded-[8px] border border-[#3A3A3C] bg-[#1F1F1E] px-3 text-[13px] font-semibold text-white">
              {readableAssets.map((asset) => <option key={asset.assetId} value={asset.assetId}>{asset.assetName}</option>)}
            </select>
            <div className="mt-5 flex items-center justify-between gap-2">
              <div className="text-[12px] font-bold text-[#86868B]">컴포넌트 선택 및 순서</div>
              <span className="rounded-full border border-[#3A3A3C] bg-[#1F1F1E] px-2 py-0.5 text-[11px] font-semibold text-[#D1D1D6]">{selectedComponentOptions.length}개 선택</span>
            </div>
            <p className="mt-2 text-[11px] leading-4 text-[#86868B]">선택된 항목은 위에 고정되고, 위/아래 또는 드래그 순서가 PDF 출력 순서와 동일하게 반영됩니다.</p>
            <div className="mt-2 space-y-2">
              {orderedComponentOptions.map((option) => {
                const checked = activeComponentIds.includes(option.id);
                const selectedIndex = activeComponentIds.indexOf(option.id);
                return (
                  <div
                    key={option.id}
                    draggable={checked}
                    onDragStart={() => checked && setDraggingComponentId(option.id)}
                    onDragOver={(event) => {
                      if (checked && draggingComponentId) event.preventDefault();
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      if (checked) reorderComponent(draggingComponentId, option.id);
                      setDraggingComponentId(null);
                    }}
                    onDragEnd={() => setDraggingComponentId(null)}
                    className={`flex items-center gap-2 rounded-[10px] border p-2 transition-colors ${checked ? 'cursor-grab border-[#34537A] bg-[#172A43] active:cursor-grabbing' : 'border-[#333333] bg-[#1F1F1E] opacity-75'}`}
                  >
                    <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-[13px] font-semibold text-white">
                      <input type="checkbox" checked={checked} onChange={(event) => {
                        toggleComponent(option.id, event.target.checked);
                      }} />
                      {checked ? <span className="shrink-0 rounded-full bg-[#2997ff] px-1.5 py-0.5 text-[10px] font-bold text-white">{selectedIndex + 1}</span> : null}
                      <span className="truncate">{option.label}</span>
                    </label>
                    <button type="button" onClick={() => moveComponent(option.id, 'up')} disabled={!checked} className="h-7 w-7 rounded-[7px] border border-[#3A3A3C] text-[12px] text-[#D1D1D6] disabled:opacity-30">↑</button>
                    <button type="button" onClick={() => moveComponent(option.id, 'down')} disabled={!checked} className="h-7 w-7 rounded-[7px] border border-[#3A3A3C] text-[12px] text-[#D1D1D6] disabled:opacity-30">↓</button>
                  </div>
                );
              })}
            </div>
          </aside>
          <main ref={printScopeRef} data-pdf-print-scope="true" className="pdf-print-scope space-y-4">
            <div className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
              <div className="text-[12px] font-semibold text-[#86868B]">REPORT PREVIEW</div>
              <h1 className="mt-1 text-[26px] font-bold text-white">{selectedAsset.assetName || '자산 선택 필요'}</h1>
              <p className="mt-2 text-[13px] text-[#A1A1AA]">Dashboard 데이터를 읽기 권한 범위 안에서 조합한 PDF 미리보기입니다. PDF는 A4 세로 형식으로 선택 컴포넌트를 위에서 아래로 출력합니다.</p>
            </div>
            {activeComponentIds.map((id) => <React.Fragment key={id}>{renderComponent(id)}</React.Fragment>)}
          </main>
        </section>
      </div>
    </div>
  );
}

function ReportPreviewCard({ title, children }) {
  return (
    <section className="pdf-report-card rounded-[20px] border border-[#333333] bg-[#252524] p-5">
      <h2 className="mb-4 text-[18px] font-bold text-white">{title}</h2>
      {children}
    </section>
  );
}

function ExternalRefreshResultView({ summary, headers, rows, note }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {summary.map((item) => (
          <div key={item.label} className="rounded-[12px] border border-[#333333] bg-[#1F1F1E] px-4 py-3">
            <div className="text-[12px] font-semibold text-[#86868B]">{item.label}</div>
            <div className="mt-1 text-[20px] font-semibold text-white tabular-nums">{item.value}</div>
          </div>
        ))}
      </div>
      {note ? <div className="rounded-[12px] border border-[#3A3A3C] bg-[#1F1F1E] px-4 py-3 text-[13px] leading-5 text-[#C7C7CC]">{note}</div> : null}
      <DataTable headers={headers} rows={rows} compact />
    </div>
  );
}

function ExternalApiRefreshControls({ dashboardDataset, permission, onOpenModal }) {
  const [running, setRunning] = useState('');
  const sourceRows = useMemo(() => filterAssetsByPermission(dashboardDataset.generalRows || [], permission), [dashboardDataset.generalRows, permission]);
  const readableAssets = useMemo(() => filterAssetsByPermission(dashboardDataset.assetOptions || [], permission), [dashboardDataset.assetOptions, permission]);
  const readableCompanies = useMemo(() => companyOptionsFromDashboardRows(sourceRows, dashboardDataset.companyOptions || companyOptionsData), [dashboardDataset.companyOptions, sourceRows]);
  const buildingTargets = useMemo(() => buildBuildingRegisterRefreshTargets(readableAssets, sourceRows), [readableAssets, sourceRows]);
  const openDartTargets = useMemo(() => buildOpenDartRefreshTargets(readableCompanies, sourceRows), [readableCompanies, sourceRows]);

  const runBuildingRefresh = async () => {
    setRunning('building');
    const rows = [];
    try {
      for (const target of buildingTargets) {
        if (!target.ready) {
          rows.push([target.assetName, '파라미터 부족', `${target.payload.sigungu_cd || '-'} / ${target.payload.bjdong_cd || '-'} / ${target.payload.bun || '-'}-${target.payload.ji || '-'}`, '-', '미반영']);
          continue;
        }
        const { data, error } = await supabase.functions.invoke('ll-dashboard-api', {
          body: { action: 'building-register/summary', payload: { ...target.payload, force_refresh: true } },
        });
        const outcome = externalRefreshOutcome(data, error);
        rows.push([
          target.assetName,
          outcome.status,
          `${target.payload.sigungu_cd} / ${target.payload.bjdong_cd} / ${target.payload.bun}-${target.payload.ji}`,
          data?.data?.plat_plc || data?.data?.new_plat_plc || '-',
          outcome.stored ? 'Supabase 반영' : outcome.message,
        ]);
      }
    } finally {
      setRunning('');
    }
    const successCount = rows.filter((row) => row[1] === '새로고침 완료').length;
    const skippedCount = rows.filter((row) => row[1] === '파라미터 부족').length;
    onOpenModal({
      title: '건축물대장 새로고침 결과',
      size: 'wide',
      content: (
        <ExternalRefreshResultView
          summary={[
            { label: '대상 자산', value: `${formatNumber(rows.length)}개` },
            { label: '새로고침 완료', value: `${formatNumber(successCount)}개` },
            { label: '파라미터 부족', value: `${formatNumber(skippedCount)}개` },
            { label: '저장 위치', value: 'Supabase' },
          ]}
          note="API key는 브라우저에 노출하지 않고 Edge Function이 서버에서만 사용합니다. 성공한 값은 ll_cache_entries에 저장됩니다."
          headers={['자산명', '상태', '조회 파라미터', '주소/대장 위치', 'Supabase 반영']}
          rows={rows}
        />
      ),
    });
  };

  const runOpenDartRefresh = async () => {
    setRunning('opendart');
    const rows = [];
    try {
      for (const target of openDartTargets) {
        if (!target.ready) {
          rows.push([target.tenantName, '-', 'corp code 없음', '-', '미반영']);
          continue;
        }
        const { data, error } = await supabase.functions.invoke('ll-dashboard-api', {
          body: { action: 'opendart/company', payload: { corp_code: target.corpCode, include_financials: true, force_refresh: true } },
        });
        const outcome = externalRefreshOutcome(data, error);
        const financialRowCount = Array.isArray(data?.data?.financials) ? data.data.financials.length : 0;
        rows.push([
          target.tenantName,
          target.corpCode,
          outcome.status,
          financialRowCount ? `${formatNumber(financialRowCount)}개` : '-',
          outcome.stored ? 'Supabase 반영' : outcome.message,
        ]);
      }
    } finally {
      setRunning('');
    }
    const successCount = rows.filter((row) => row[2] === '새로고침 완료').length;
    const skippedCount = rows.filter((row) => row[2] === 'corp code 없음').length;
    onOpenModal({
      title: 'OpenDART 새로고침 결과',
      size: 'wide',
      content: (
        <ExternalRefreshResultView
          summary={[
            { label: '대상 기업', value: `${formatNumber(rows.length)}개` },
            { label: '새로고침 완료', value: `${formatNumber(successCount)}개` },
            { label: 'corp code 없음', value: `${formatNumber(skippedCount)}개` },
            { label: '저장 위치', value: 'Supabase' },
          ]}
          note="OpenDART도 API key는 Edge Function 안에서만 사용합니다. 실시간 원천 호출이 실패하면 기존 저장값을 유지하고, 그 경우는 새로고침 완료로 세지 않습니다."
          headers={['기업명', 'OpenDART corp code', '상태', '재무 row', 'Supabase 반영']}
          rows={rows}
        />
      ),
    });
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <button
        type="button"
        data-testid="building-register-refresh"
        disabled={Boolean(running)}
        onClick={runBuildingRefresh}
        className={`h-9 rounded-[8px] border px-3 text-[13px] font-semibold ${DARK_BUTTON_CLASS} disabled:opacity-50`}
      >
        {running === 'building' ? '건축물대장 새로고침 중' : '건축물대장 새로고침'}
      </button>
      <button
        type="button"
        data-testid="opendart-refresh"
        disabled={Boolean(running)}
        onClick={runOpenDartRefresh}
        className={`h-9 rounded-[8px] border px-3 text-[13px] font-semibold ${DARK_BUTTON_CLASS} disabled:opacity-50`}
      >
        {running === 'opendart' ? 'OpenDART 새로고침 중' : 'OpenDART 새로고침'}
      </button>
    </div>
  );
}

function DashboardShell({ activeModule }) {
  const { memberInfo } = useAuth();
  const permission = useMemo(() => resolveLogisticsPermission(memberInfo), [memberInfo]);
  const dashboardDataset = useDashboardHomeReadDataset(memberInfo, canViewAdvancedLogisticsTools(memberInfo, permission));
  const [modal, setModal] = useState(null);
  const visibleModules = useMemo(() => (
    MODULES.filter((item) => !ADMIN_ONLY_MODULE_IDS.has(item.id) || canViewAdvancedLogisticsTools(memberInfo, permission))
  ), [memberInfo, permission]);
  const selected = visibleModules.find((item) => item.id === activeModule) || visibleModules[0];
  const canUseExternalApiRefresh = canViewAdvancedLogisticsTools(memberInfo, permission);
  const [mountedModuleIds, setMountedModuleIds] = useState(() => new Set([selected?.id].filter(Boolean)));
  useEffect(() => {
    if (!selected?.id) return undefined;
    const timer = window.setTimeout(() => {
      setMountedModuleIds((previous) => {
        if (previous.has(selected.id)) return previous;
        const next = new Set(previous);
        next.add(selected.id);
        return next;
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [selected?.id]);
  const mountedIds = useMemo(() => {
    const visibleIds = new Set(visibleModules.map((item) => item.id));
    return new Set([...mountedModuleIds, selected?.id].filter((id) => id && visibleIds.has(id)));
  }, [mountedModuleIds, selected?.id, visibleModules]);
  const renderDashboardModule = (moduleId) => (
    moduleId === 'home' ? <HomeDashboard />
      : moduleId === 'asset' ? <AssetDashboard />
        : moduleId === 'company' ? <CompanyDashboard />
          : moduleId === 'tools' ? <AnalysisToolsDashboard />
            : moduleId === 'playground' ? <DataPlaygroundDashboard />
              : moduleId === 'quality' ? <DataQualityDashboard />
                : null
  );

  return (
    <div className="w-full max-w-[1480px] mx-auto px-8 pt-8 pb-14">
      <LogisticsModal modal={modal} onClose={() => setModal(null)} />
      <SectionHeader
        title={selected.label}
        right={canUseExternalApiRefresh ? (
          <ExternalApiRefreshControls dashboardDataset={dashboardDataset} permission={permission} onOpenModal={setModal} />
        ) : null}
      />

      <div className="relative">
        {visibleModules.filter((item) => mountedIds.has(item.id)).map((item) => (
          <div key={item.id} className={selected.id === item.id ? 'block' : 'hidden'} aria-hidden={selected.id !== item.id}>
            {renderDashboardModule(item.id)}
          </div>
        ))}
      </div>
    </div>
  );
}

function LegacyWorkspaceLogistics({ currentPath = '' }) {
  const { memberInfo } = useAuth();
  const [query, setQuery] = useState('');
  const [scopeFilter, setScopeFilter] = useState('전체');
  const permission = useMemo(() => resolveLogisticsPermission(memberInfo), [memberInfo]);

  const isContractData = normalizeLogisticsPath(currentPath) === pathFor('contract-data');
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

  if (isContractData) {
    return (
      <div className="w-full max-w-[1480px] mx-auto px-8 pt-8 pb-14">
        <ContractDataManagementDashboard />
      </div>
    );
  }

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
            <h1 className="text-[34px] font-semibold tracking-tight text-white">Work Platform</h1>
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
