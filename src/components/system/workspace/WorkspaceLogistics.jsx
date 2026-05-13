import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../../utils/supabaseClient';
import { useAuth } from '../../../context/AuthContext';
import weeklyReportData from './logisticsWeeklyReportData.json';
import homeData from './logisticsHomeData.json';
import assetOptionsData from './logisticsAssetOptionsData.json';
import companyOptionsData from './logisticsCompanyOptionsData.json';
import sectorData from './logisticsSectorData.json';

const assetPayloadModules = import.meta.glob('./logisticsAssetData/*.json', { eager: true });
const ASSET_PAYLOADS = Object.fromEntries(Object.values(assetPayloadModules)
  .map((module) => module.default)
  .filter(Boolean)
  .map((payload) => [payload.overview?.assetId || payload.meta?.selection?.assetId, payload]));
const companyPayloadModules = import.meta.glob('./logisticsCompanyData/*.json', { eager: true });
const COMPANY_PAYLOADS = Object.fromEntries(Object.values(companyPayloadModules)
  .map((module) => module.default)
  .filter(Boolean)
  .map((payload) => [payload.meta?.selection?.tenantId || payload.filters?.selectedTenantId || payload.profile?.tenantId, payload]));

const MODULES = [
  { id: 'weekly', label: 'Weekly', source: '주간 업무' },
  { id: 'home', label: 'Home', source: 'Home' },
  { id: 'asset', label: 'Asset', source: 'Asset' },
  { id: 'company', label: 'Company', source: 'Company' },
  { id: 'sector', label: 'Sector', source: 'Sector' },
  { id: 'tools', label: 'Analysis Tools', source: 'Analysis Tools' },
  { id: 'playground', label: 'Data Playground', source: 'Data Playground' },
  { id: 'quality', label: 'Data Quality', source: 'Data Quality' },
];

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

const NAVER_MAPS_CLIENT_ID = import.meta.env.VITE_NAVER_MAPS_CLIENT_ID || 'xmxdr3l9ij';

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

function navigateTo(path) {
  const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL.slice(0, -1) : import.meta.env.BASE_URL;
  window.location.href = `${base}/${path}`;
}

function normalizeWeeklyAssetKey(value) {
  return String(value || '').replace(/\s+/g, '').replace(/센터|물류센터|,|㈜|\(주\)|주식회사/g, '').trim();
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

function formatNumber(value) {
  if (value === undefined || value === null || value === '') return '-';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return cleanDisplay(value);
  return new Intl.NumberFormat('ko-KR').format(numeric);
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
  return `${(numeric * 100).toFixed(1)}%`;
}

function formatArea(value) {
  if (value === undefined || value === null || value === '') return '-';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '-';
  return `${formatNumber(Math.round(numeric))}㎡`;
}

function formatPy(value) {
  if (value === undefined || value === null || value === '') return '-';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '-';
  return `${formatNumber(Math.round(numeric / 3.305785))}평`;
}

function formatCurrency(value) {
  if (value === undefined || value === null || value === '') return '-';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '-';
  if (Math.abs(numeric) >= 100000000) return `${formatNumber(Math.round(numeric / 100000000))}억`;
  if (Math.abs(numeric) >= 10000) return `${formatNumber(Math.round(numeric / 10000))}만`;
  return formatNumber(Math.round(numeric));
}

function formatDate(value) {
  return String(value || '-').slice(0, 10);
}

function formatMetric(value, type) {
  if (type === 'area') return formatArea(value);
  if (type === 'currency') return formatCurrency(value);
  if (type === 'percent') return formatPercent(value);
  if (type === 'date') return formatDate(value);
  return formatNumber(value);
}

function normalizeWeeklyAssetRows(rows) {
  return (rows || []).map((row) => {
    const context = resolveWeeklyAssetContext(row) || {};
    return {
      ...row,
      originalAssetName: row.originalAssetName || row.assetName || '',
      assetName: context.assetName || row.assetName || '-',
      fundName: cleanDisplay(row.fundName || context.fundName, ''),
      leaseMaturity: row.leaseMaturity || context.leaseMaturity || '',
    };
  });
}

function projectSummaryRows(row, section) {
  const planLabel = section === 'newProjects' ? '운영 메모' : '계획';
  return [
    ['프로젝트', row.projectName || row.assetName || '-'],
    ['리스크/자금', cleanDisplay(row.risk || row.funding, '검토')],
    ['진행 상태', cleanDisplay(row.status)],
    ['주요 이슈', cleanDisplay(row.issue)],
    [planLabel, cleanDisplay(row.plan)],
  ];
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

function DataTable({ headers, rows, onRowClick, compact = false }) {
  return (
    <div className="overflow-auto rounded-[10px] border border-[#333333]">
      <table className="w-full min-w-[760px] text-left border-collapse">
        <thead className="bg-[#1F1F1E] text-[#86868B] text-[12px]">
          <tr>
            {headers.map((header) => (
              <th key={header} className="py-2 px-3 first:pl-4 last:pr-4 font-semibold whitespace-nowrap">{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr
              key={`${rowIndex}-${row.join('|')}`}
              onClick={() => onRowClick?.(rowIndex)}
              className={`border-b border-[#333333] last:border-b-0 ${onRowClick ? 'cursor-pointer hover:bg-white/[0.04]' : ''}`}
            >
              {row.map((cell, cellIndex) => (
                <td key={`${cellIndex}-${cell}`} className={`${compact ? 'py-1.5' : 'py-2.5'} px-3 first:pl-4 last:pr-4 text-[13px] text-[#E5E5E5] align-top`}>
                  {cell || '-'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LogisticsModal({ modal, onClose }) {
  if (!modal) return null;
  return (
    <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center px-6 py-8" role="dialog" aria-modal="true">
      <div className="w-full max-w-[1120px] max-h-[88vh] overflow-hidden rounded-[18px] border border-[#3A3A3C] bg-[#252524] shadow-2xl">
        <div className="px-6 py-5 border-b border-[#333333] flex items-center justify-between gap-4">
          <div>
            <div className="text-[12px] text-[#86868B] font-semibold">DETAIL</div>
            <h3 className="text-[22px] text-white font-semibold tracking-tight mt-1">{modal.title}</h3>
          </div>
          <button type="button" onClick={onClose} className="h-9 px-3 rounded-[8px] bg-[#1F1F1E] text-[#C7C7CC] text-[13px] font-semibold hover:bg-[#30302F]">닫기</button>
        </div>
        <div className="p-6 overflow-auto max-h-[calc(88vh-88px)]">
          {modal.rows ? (
            <DataTable headers={modal.headers} rows={modal.rows} compact />
          ) : modal.content}
        </div>
      </div>
    </div>
  );
}

function ProjectDetail({ project, section, onRaw }) {
  const overviewRows = (project.detailRows || []).slice(0, 7).map((item) => [item.label, cleanDisplay(item.value)]);
  const financeRows = (project.detailRows || []).slice(7).map((item) => [item.label, cleanDisplay(item.value)]);
  return (
    <article className="rounded-[14px] border border-[#333333] bg-[#1F1F1E] p-4">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <StatusPill className="bg-[#252524] text-[#C7C7CC] border-[#3A3A3C]">{cleanDisplay(project.risk || project.funding, 'Project')}</StatusPill>
          <h4 className="text-[18px] text-white font-semibold mt-3">{project.projectName}</h4>
        </div>
        <button type="button" onClick={onRaw} className="h-9 px-3 rounded-[8px] bg-[#30302F] text-white text-[13px] font-semibold hover:bg-[#3A3A3A]">상세 원문 보기</button>
      </div>
      <div className="space-y-4">
        <DataTable headers={['구분', '내용']} rows={projectSummaryRows(project, section)} compact />
        <DataTable headers={['항목', '내용']} rows={overviewRows} compact />
        <DataTable headers={['재무/투자조건', '내용']} rows={financeRows} compact />
      </div>
    </article>
  );
}

function WeeklyDashboard() {
  const [selectedWeekKey, setSelectedWeekKey] = useState(WEEKLY_REPORT_LIBRARY[0]?.key || '');
  const selectedWeeklyEntry = WEEKLY_REPORT_LIBRARY.find((item) => item.key === selectedWeekKey) || WEEKLY_REPORT_LIBRARY[0];
  const report = selectedWeeklyEntry?.report || weeklyReportData;
  const assetRows = useMemo(() => normalizeWeeklyAssetRows(report.assetRows || []), [report.assetRows]);
  const [assetView, setAssetView] = useState('core');
  const [selectedNewId, setSelectedNewId] = useState(report.newProjects?.[0]?.id || '');
  const [selectedManagementId, setSelectedManagementId] = useState(report.managementProjects?.[0]?.id || '');
  const [modal, setModal] = useState(null);
  const availableYears = [...new Set(WEEKLY_REPORT_LIBRARY.map((item) => item.year))];
  const availableMonths = [...new Set(WEEKLY_REPORT_LIBRARY.filter((item) => item.year === selectedWeeklyEntry?.year).map((item) => item.month))];
  const availableWeeks = WEEKLY_REPORT_LIBRARY.filter((item) => item.year === selectedWeeklyEntry?.year && item.month === selectedWeeklyEntry?.month);

  const selectedNew = (report.newProjects || []).find((item) => item.id === selectedNewId) || report.newProjects?.[0];
  const selectedManagement = (report.managementProjects || []).find((item) => item.id === selectedManagementId) || report.managementProjects?.[0];
  const totalArea = Number(report.summary?.totalGrossAreaPy || assetRows.reduce((sum, row) => sum + Number(row.grossAreaPy || 0), 0));

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

  const coreHeaders = ['자산명', '펀드명', '종류', '임대차만기', '펀드만기', '대출만기', '임대율', '주요임차사', 'Main Issue'];
  const fullHeaders = ['자산명', '펀드명', '종류', '연면적(평)', '준공', '투자유형', '매입시점', '임대차만기', '펀드만기', '대출만기', '원가', '현재대비', '저온비율', '임대율', '주요임차사', 'Main Issue'];
  const tableRows = assetRows.map((row) => (
    assetView === 'full'
      ? [row.assetName, cleanDisplay(row.fundName), row.category, formatNumber(row.grossAreaPy), row.completion, row.investmentType, row.acquisition, row.leaseMaturity || '-', row.fundMaturity || '-', row.loanMaturity || '-', cleanDisplay(row.costPerPy), cleanDisplay(row.costTrend), cleanDisplay(row.coldRatio), cleanDisplay(row.occupancyRate), cleanDisplay(row.mainTenant), cleanDisplay(row.mainIssue)]
      : [row.assetName, cleanDisplay(row.fundName), row.category, row.leaseMaturity || '-', row.fundMaturity || '-', row.loanMaturity || '-', cleanDisplay(row.occupancyRate), cleanDisplay(row.mainTenant), cleanDisplay(row.mainIssue)]
  ));

  return (
    <div className="space-y-6">
      <LogisticsModal modal={modal} onClose={() => setModal(null)} />
      <section className="border border-[#333333] rounded-[20px] bg-[#252524] p-5">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <div className="text-[12px] text-[#86868B] font-semibold">Weekly Operations</div>
            <h3 className="text-[24px] text-white font-semibold tracking-tight mt-1">{report.reportTitle}</h3>
          </div>
          <StatusPill className="bg-[#173522] text-[#B5E48C] border-[#2E6B45]">읽기 전용</StatusPill>
        </div>
        <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="block">
            <span className="mb-2 block text-[12px] font-semibold text-[#86868B]">연도</span>
            <select
              value={selectedWeeklyEntry?.year || ''}
              onChange={(event) => {
                const next = WEEKLY_REPORT_LIBRARY.find((item) => item.year === event.target.value) || WEEKLY_REPORT_LIBRARY[0];
                setSelectedWeekKey(next.key);
              }}
              className="h-10 w-full rounded-[8px] border border-[#3A3A3C] bg-[#1F1F1E] px-3 text-[13px] text-white outline-none"
            >
              {availableYears.map((year) => <option key={year} value={year}>{year}년</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-[12px] font-semibold text-[#86868B]">월</span>
            <select
              value={selectedWeeklyEntry?.month || ''}
              onChange={(event) => {
                const next = WEEKLY_REPORT_LIBRARY.find((item) => item.year === selectedWeeklyEntry?.year && item.month === event.target.value) || WEEKLY_REPORT_LIBRARY[0];
                setSelectedWeekKey(next.key);
              }}
              className="h-10 w-full rounded-[8px] border border-[#3A3A3C] bg-[#1F1F1E] px-3 text-[13px] text-white outline-none"
            >
              {availableMonths.map((month) => <option key={month} value={month}>{Number(month)}월</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-[12px] font-semibold text-[#86868B]">주차</span>
            <select
              value={selectedWeekKey}
              onChange={(event) => setSelectedWeekKey(event.target.value)}
              className="h-10 w-full rounded-[8px] border border-[#3A3A3C] bg-[#1F1F1E] px-3 text-[13px] text-white outline-none"
            >
              {availableWeeks.map((week) => <option key={week.key} value={week.key}>{week.label}</option>)}
            </select>
          </label>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-[14px] border border-[#333333] bg-[#1F1F1E] px-4 py-4">
            <div className="text-[12px] text-[#86868B] font-semibold">보고일</div>
            <div className="text-[24px] text-white font-semibold mt-2">{report.reportDate}</div>
          </div>
          <button type="button" onClick={openAssetsModal} className="text-left rounded-[14px] border border-[#333333] bg-[#1F1F1E] px-4 py-4 hover:bg-[#2A2A29]">
            <div className="text-[12px] text-[#86868B] font-semibold">총 자산 수</div>
            <div className="text-[24px] text-[#B5E48C] font-semibold mt-2">{formatNumber(report.summary?.assetCount || assetRows.length)}개</div>
          </button>
          <button type="button" onClick={openAreaModal} className="text-left rounded-[14px] border border-[#333333] bg-[#1F1F1E] px-4 py-4 hover:bg-[#2A2A29]">
            <div className="text-[12px] text-[#86868B] font-semibold">총 연면적</div>
            <div className="text-[24px] text-[#9AD7FF] font-semibold mt-2">{formatNumber(totalArea)}평</div>
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

      <section className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
        <SectionHeader eyebrow="NOTES" title="기준 및 기타사항" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {(report.notes || []).map((note) => (
            <div key={note.id} className="rounded-[12px] border border-[#333333] bg-[#1F1F1E] p-4">
              <div className="text-[14px] text-white font-semibold">{note.title}</div>
              <div className="text-[13px] text-[#A1A1AA] leading-6 mt-2">{note.body}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

void LegacyWorkspaceLogistics;

const MAIN_WORKLOGS = [
  {
    id: 'log-001',
    project: '물류센터 섹터',
    cell: '사업PM',
    owner: '이서정',
    title: '[리스크 판단] 이천 회억리 Refi 및 임대차 진행 상황 점검',
    body: '대주단 미팅 일정과 지상 1층 임대차 마케팅 후속 액션을 이번 주 우선 확인합니다.',
    stakeholder: '대주단 / 잠재임차사',
    purpose: '리스크 판단',
    status: '검토중',
    priority: '높음',
    date: '26.05.13',
    locked: true,
  },
  {
    id: 'log-002',
    project: '물류센터 섹터',
    cell: '사업PM',
    owner: '전기용',
    title: '[공유] 물류 복합개발 PJT 투자조건 협의 업데이트',
    body: '환경개선펀드와 매칭투자자 조건 협의 후 설정시기 확정이 필요합니다.',
    stakeholder: '산단공 / 매칭투자자',
    purpose: '공유',
    status: '진행중',
    priority: '중간',
    date: '26.05.13',
    locked: false,
  },
  {
    id: 'log-003',
    project: '물류센터 섹터',
    cell: '임대차',
    owner: '권순일',
    title: 'Lease-up 대상 자산 우선순위 및 공실 원인 재확인',
    body: 'Home과 Sector 탭의 공실/만기 이슈를 기준으로 영업 우선순위를 재정렬합니다.',
    stakeholder: 'AM / Leasing',
    purpose: '의사결정',
    status: '신규',
    priority: '중간',
    date: '26.05.12',
    locked: false,
  },
  {
    id: 'log-004',
    project: '물류센터 섹터',
    cell: '데이터',
    owner: '강순용',
    title: '탭별 원본 숫자와 팝업 내용 parity QA 진행',
    body: '대시보드 데이터 검증은 Dashboard 모듈 안에서 처리하고, 업무 로그는 현안 공유 중심으로 유지합니다.',
    stakeholder: '데이터 QA',
    purpose: '진행 이력',
    status: '진행중',
    priority: '낮음',
    date: '26.05.10',
    locked: false,
  },
  {
    id: 'log-005',
    project: '물류센터 섹터',
    cell: '섹터PM',
    owner: '이서정',
    title: '주간 주요 이슈를 업무 로그 메인과 Weekly 탭에 동시 반영',
    body: '자산별 세부 특징은 Dashboard 내부 탭에서 보고, 메인에서는 현재 업무 현황과 주요 이슈만 공유합니다.',
    stakeholder: '섹터 담당자',
    purpose: '공유',
    status: '보류',
    priority: '중간',
    date: '26.05.09',
    locked: false,
  },
];

const MAIN_PURPOSES = ['공유', '리스크 판단', '의사결정', '진행 이력'];
const MAIN_STATUSES = ['신규', '검토중', '진행중', '보류'];
const MAIN_PRIORITIES = ['높음', '중간', '낮음'];
const MAIN_SORT_OPTIONS = [
  { id: 'priority', label: '중요도순' },
  { id: 'due', label: '마감순' },
  { id: 'status', label: '상태순' },
];

const DASHBOARD_STORYLINES = [
  { id: 'weekly', step: '01', title: '이번 주 업무 현황', body: '의사결정 필요 이슈와 Next Action을 먼저 확인합니다.' },
  { id: 'home', step: '02', title: '포트폴리오 전체 조망', body: '운영 자산, 임차인, 만기, 공실을 한 화면에서 좁힙니다.' },
  { id: 'asset', step: '03', title: '자산별 상세 판단', body: '선택 자산의 임차, 면적, 지도, 만기 구조를 확인합니다.' },
  { id: 'company', step: '04', title: '회사별 노출 점검', body: '임차 회사의 자산 노출과 계약 리스크를 따라갑니다.' },
  { id: 'sector', step: '05', title: '섹터 비교와 우선순위', body: '권역, Top 자산, Top 임차인, 만기 집중도를 비교합니다.' },
  { id: 'quality', step: '06', title: '데이터 확인', body: '원본 보존, 빈값, QA 이슈는 업무 화면이 아닌 검증 탭에서 봅니다.' },
];

const WEEKLY_REPORT_LIBRARY = [
  {
    key: '2026-04-w4',
    year: '2026',
    month: '04',
    week: '4',
    label: '2026년 4월 4주',
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

function mainPriorityWeight(priority) {
  return { 높음: 0, 중간: 1, 낮음: 2 }[priority] ?? 9;
}

function mainStatusWeight(status) {
  return { 검토중: 0, 진행중: 1, 신규: 2, 보류: 3 }[status] ?? 9;
}

function formatMainToday() {
  const date = new Date();
  const day = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${day})`;
}

function shortLogDate() {
  const date = new Date();
  return `${String(date.getFullYear()).slice(-2)}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}

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

function buildMainWeeklyTasks(report) {
  const rows = [...(report.newProjects || []), ...(report.managementProjects || [])];
  return rows.slice(0, 6).map((row, index) => {
    const meta = inferMainTaskMeta(row, index);
    return {
      id: row.id || `main-task-${index + 1}`,
      taskName: cleanDisplay(row.projectName || row.assetName, `Weekly Task ${index + 1}`),
      nextAction: trimMainText(row.plan || row.issue || row.status || '후속 액션 확인 필요'),
      issue: trimMainText(row.issue || row.status || '주요 이슈 없음', 108),
      stakeholder: meta.stakeholder,
      dueDate: meta.dueDate,
      status: meta.status,
      priority: meta.priority,
    };
  });
}

function sortMainTasks(tasks, sortMode) {
  const next = [...tasks];
  if (sortMode === 'due') return next.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  if (sortMode === 'status') return next.sort((a, b) => mainStatusWeight(a.status) - mainStatusWeight(b.status));
  return next.sort((a, b) => mainPriorityWeight(a.priority) - mainPriorityWeight(b.priority));
}

function WeeklyWordUploadPanel() {
  const [selectedWeekKey, setSelectedWeekKey] = useState(WEEKLY_REPORT_LIBRARY[0]?.key || '');
  const [file, setFile] = useState(null);
  const [uploadState, setUploadState] = useState({ status: 'idle', message: '' });
  const selectedWeek = WEEKLY_REPORT_LIBRARY.find((item) => item.key === selectedWeekKey) || WEEKLY_REPORT_LIBRARY[0];

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
    formData.append('week_key', selectedWeek?.key || '');
    formData.append('source_template', 'RA부문_사업그룹4파트_주간업무자료');

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
    <section className="mb-4 rounded-[22px] border border-[#333333] bg-[#252524] p-5">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_260px_220px] xl:items-end">
        <div>
          <div className="text-[11px] font-semibold tracking-[0.03em] text-[#86868B]">WEEKLY WORD INGEST</div>
          <h2 className="mt-1 text-[18px] font-semibold text-white">주간업무자료 Word 업로드</h2>
          <p className="mt-2 text-[13px] leading-6 text-[#A1A1AA] break-keep">
            기준 양식과 유사한 Word 파일을 올리면 서버에서 표와 본문을 읽어 주차별 Weekly 데이터와 Supabase ll_* 저장 대상으로 변환합니다.
          </p>
        </div>
        <div>
          <label className="mb-2 block text-[12px] font-semibold text-[#86868B]">반영 주차</label>
          <select
            value={selectedWeekKey}
            onChange={(event) => setSelectedWeekKey(event.target.value)}
            className="h-10 w-full rounded-[8px] border border-[#3A3A3C] bg-[#1F1F1E] px-3 text-[13px] text-white outline-none"
          >
            {WEEKLY_REPORT_LIBRARY.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-2 block text-[12px] font-semibold text-[#86868B]">Word 파일</label>
          <input
            type="file"
            accept=".doc,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
            onChange={(event) => setFile(event.target.files?.[0] || null)}
            className="block w-full text-[12px] text-[#A1A1AA] file:mr-3 file:h-10 file:rounded-[8px] file:border-0 file:bg-[#30302F] file:px-3 file:text-[12px] file:font-semibold file:text-white hover:file:bg-[#3A3A3A]"
          />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-[12px] text-[#86868B]">
          기준 파일: {selectedWeek?.sourceName || '주간업무자료 Word'} · DB 반영은 브라우저가 아니라 서버 함수에서만 처리합니다.
        </div>
        <button
          type="button"
          onClick={handleSubmit}
          className="h-10 rounded-[10px] border border-[#2C66A2] bg-[#17314E] px-5 text-[13px] font-semibold text-[#9AD7FF] hover:bg-[#1E3C5F]"
        >
          Word 읽기 및 Weekly 반영
        </button>
      </div>
      {uploadState.message && (
        <div className={`mt-3 rounded-[10px] border px-4 py-3 text-[13px] leading-6 ${uploadState.status === 'success' ? 'border-[#2E6B45] bg-[#173522] text-[#B5E48C]' : uploadState.status === 'loading' ? 'border-[#34537A] bg-[#202C3D] text-[#9AD7FF]' : 'border-[#7A6425] bg-[#2B2613] text-[#FFD166]'}`}>
          {uploadState.message}
        </div>
      )}
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

function DashboardStoryRail({ activeId }) {
  return (
    <section className="mb-6 rounded-[20px] border border-[#333333] bg-[#252524] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold tracking-[0.03em] text-[#86868B]">DASHBOARD STORYLINE</div>
          <h3 className="mt-1 text-[17px] font-semibold text-white">업무 흐름 기준 탭 배치</h3>
        </div>
        <div className="text-[12px] text-[#86868B]">Weekly에서 시작해 자산, 회사, 섹터, 데이터 검증으로 좁혀갑니다.</div>
      </div>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-6">
        {DASHBOARD_STORYLINES.map((item) => {
          const active = item.id === activeId;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => navigateTo(pathFor(`dashboard/${item.id}`))}
              className={`min-h-[118px] rounded-[14px] border p-4 text-left transition-colors ${active ? 'border-[#8ECBE6] bg-[#1F2B31]' : 'border-[#333333] bg-[#1F1F1E] hover:bg-[#2A2A29]'}`}
            >
              <div className="text-[12px] font-bold text-[#86868B]">{item.step}</div>
              <div className={`mt-2 text-[14px] font-semibold leading-5 break-keep ${active ? 'text-white' : 'text-[#D1D1D6]'}`}>{item.title}</div>
              <p className="mt-2 text-[12px] leading-5 text-[#86868B] break-keep">{item.body}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default function WorkspaceLogistics({ currentPath = '' }) {
  const { memberInfo } = useAuth();
  const [query, setQuery] = useState('');
  const [scopeFilter, setScopeFilter] = useState('전체');
  const [purposeFilter, setPurposeFilter] = useState('전체');
  const [statusFilter, setStatusFilter] = useState('전체');
  const [taskSort, setTaskSort] = useState('priority');
  const [showAllLogs, setShowAllLogs] = useState(false);
  const [showAllTasks, setShowAllTasks] = useState(false);
  const [worklogs, setWorklogs] = useState(() => MAIN_WORKLOGS);
  const [draftLog, setDraftLog] = useState({
    project: '물류센터 섹터',
    purpose: '공유',
    status: '검토중',
    priority: '중간',
    stakeholder: '',
    title: '',
    body: '',
  });

  const isDashboard = currentPath.startsWith(pathFor('dashboard'));
  const activeModule = currentPath.split('/').pop() || 'weekly';
  const weeklyTasks = useMemo(() => buildMainWeeklyTasks(weeklyReportData), []);
  const sortedWeeklyTasks = useMemo(() => sortMainTasks(weeklyTasks, taskSort), [weeklyTasks, taskSort]);
  const visibleTasks = showAllTasks ? sortedWeeklyTasks : sortedWeeklyTasks.slice(0, 5);

  const visibleLogs = useMemo(() => {
    const text = query.trim().toLowerCase();
    return worklogs.filter((item) => {
      const matchesScope = scopeFilter === '전체' || item.cell.includes(scopeFilter) || item.project.includes(scopeFilter);
      const matchesPurpose = purposeFilter === '전체' || item.purpose === purposeFilter;
      const matchesStatus = statusFilter === '전체' || item.status === statusFilter;
      if (!matchesScope || !matchesPurpose || !matchesStatus) return false;
      if (!text) return true;
      return [item.project, item.cell, item.owner, item.title, item.body, item.stakeholder, item.purpose, item.status, item.priority]
        .join(' ')
        .toLowerCase()
        .includes(text);
    });
  }, [query, scopeFilter, purposeFilter, statusFilter, worklogs]);

  if (isDashboard) {
    return <DashboardShell activeModule={MODULES.some((item) => item.id === activeModule) ? activeModule : 'weekly'} />;
  }

  const displayedLogs = showAllLogs ? visibleLogs : visibleLogs.slice(0, 5);
  const weeklySummary = [
    { label: '관리 자산', value: formatNumber(weeklyReportData.summary?.assetCount), tone: 'text-[#B5E48C]' },
    { label: '위험 자산', value: formatNumber(weeklyReportData.summary?.riskAssetCount), tone: 'text-[#FF9F9F]' },
    { label: 'Lease-up 이슈', value: formatNumber(weeklyReportData.summary?.leaseUpIssueCount), tone: 'text-[#FFD166]' },
    { label: '주요 Task', value: formatNumber(weeklyTasks.length), tone: 'text-[#9AD7FF]' },
  ];

  function handleAddLog() {
    const title = draftLog.title.trim();
    const body = draftLog.body.trim();
    if (!title || !body) return;
    setWorklogs((items) => [{
      id: `log-${Date.now()}`,
      project: draftLog.project,
      cell: '사업PM',
      owner: memberInfo?.staff_name || '사용자',
      title,
      body,
      stakeholder: draftLog.stakeholder.trim() || '내부 공유',
      purpose: draftLog.purpose,
      status: draftLog.status,
      priority: draftLog.priority,
      date: shortLogDate(),
      locked: draftLog.priority === '높음' && draftLog.purpose === '리스크 판단',
    }, ...items]);
    setDraftLog((prev) => ({ ...prev, title: '', body: '', stakeholder: '' }));
  }

  return (
    <div className="w-full max-w-[1480px] mx-auto px-8 pt-6 pb-14">
      <header className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="text-[13px] font-semibold text-[#86868B] tracking-[0.03em]">LOGISTICS SECTOR WORKSPACE</div>
          <h1 className="mt-2 text-[26px] font-semibold tracking-tight text-white">물류센터 섹터 협업게시판</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-10 w-[260px] rounded-[8px] border border-[#333333] bg-[#1F1F1E] pl-9 pr-3 text-[14px] text-white placeholder:text-[#6E6E73] outline-none focus:border-[#2997ff]"
              placeholder="검색어 입력..."
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#86868B]">⌕</span>
          </div>
          <button type="button" onClick={() => setShowAllLogs((value) => !value)} className="h-10 rounded-[8px] border border-[#333333] bg-[#1F1F1E] px-4 text-[13px] font-semibold text-[#D1D1D6] hover:text-white">
            {showAllLogs ? '접기' : '전체보기'}
          </button>
        </div>
      </header>

      <WeeklyWordUploadPanel />

      <section className="mb-4 rounded-[26px] border border-[#8ECBE6]/80 bg-[#252524] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)_inset]">
        <div className="flex flex-wrap items-center gap-4 border-b border-[#333333] pb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E8F2FF] text-[13px] font-bold text-[#1F1F1E]">
            {(memberInfo?.staff_name || '물류').slice(0, 1)}
          </div>
          <select value={draftLog.project} onChange={(event) => setDraftLog({ ...draftLog, project: event.target.value })} className="h-10 rounded-[18px] border border-[#333333] bg-[#1F1F1E] px-4 text-[13px] font-bold text-white outline-none">
            <option>물류센터 섹터</option>
            <option>IOTA 공통</option>
          </select>
          <select value={draftLog.purpose} onChange={(event) => setDraftLog({ ...draftLog, purpose: event.target.value })} className="h-9 rounded-[8px] border border-[#333333] bg-[#1F1F1E] px-3 text-[13px] font-semibold text-[#D1D1D6] outline-none">
            {MAIN_PURPOSES.map((purpose) => <option key={purpose}>{purpose}</option>)}
          </select>
          <select value={draftLog.status} onChange={(event) => setDraftLog({ ...draftLog, status: event.target.value })} className="h-9 rounded-[8px] border border-[#333333] bg-[#1F1F1E] px-3 text-[13px] font-semibold text-[#D1D1D6] outline-none">
            {MAIN_STATUSES.map((status) => <option key={status}>{status}</option>)}
          </select>
          <select value={draftLog.priority} onChange={(event) => setDraftLog({ ...draftLog, priority: event.target.value })} className="h-9 rounded-[8px] border border-[#333333] bg-[#1F1F1E] px-3 text-[13px] font-semibold text-[#2997FF] outline-none">
            {MAIN_PRIORITIES.map((priority) => <option key={priority}>{priority}</option>)}
          </select>
          <div className="ml-auto text-[14px] font-semibold text-[#D1D1D6]">{formatMainToday()}</div>
        </div>
        <input
          value={draftLog.title}
          onChange={(event) => setDraftLog({ ...draftLog, title: event.target.value })}
          className="mt-4 h-12 w-full border-b border-[#333333] bg-transparent text-[16px] font-semibold text-white outline-none placeholder:text-[#86868B]"
          placeholder="제목을 입력하세요"
        />
        <textarea
          value={draftLog.body}
          onChange={(event) => setDraftLog({ ...draftLog, body: event.target.value })}
          className="mt-3 min-h-[118px] w-full resize-none bg-transparent text-[15px] leading-7 text-[#D1D1D6] outline-none placeholder:text-[#8E8E93]"
          placeholder="진행 이력, 협업 요청, 리스크 판단 필요사항, 의사결정 필요항목을 입력하세요. (@를 입력하여 담당자를 멘션할 수 있습니다)"
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="text-[13px] text-[#86868B]">이해관계자</span>
          <input
            value={draftLog.stakeholder}
            onChange={(event) => setDraftLog({ ...draftLog, stakeholder: event.target.value })}
            className="h-10 w-[210px] rounded-[8px] border border-[#333333] bg-[#1F1F1E] px-3 text-[13px] text-white outline-none placeholder:text-[#6E6E73]"
            placeholder="회사명 검색/입력"
          />
          <div className="ml-auto flex gap-2">
            <button type="button" className="h-10 rounded-[10px] border border-[#FF453A] px-4 text-[13px] font-semibold text-[#FF453A]">열람권한</button>
            <button type="button" onClick={handleAddLog} className="h-10 rounded-[10px] border border-[#3A3A3C] bg-[#30302F] px-6 text-[13px] font-semibold text-white hover:bg-[#3A3A3A]">작성하기</button>
          </div>
        </div>
      </section>

      <section className="mb-5 overflow-hidden rounded-[24px] border border-[#333333] bg-[#252524]">
        <div className="flex flex-wrap items-center gap-2 border-b border-[#333333] px-4 py-3">
          {['전체', '개인', '팀', '섹터'].map((scope) => (
            <button
              key={scope}
              type="button"
              onClick={() => setScopeFilter(scope)}
              className={`h-8 rounded-[8px] px-3 text-[12px] font-semibold transition-colors ${scopeFilter === scope ? 'bg-[#3A3A3C] text-white' : 'bg-[#1F1F1E] text-[#86868B] hover:text-white'}`}
            >
              {scope}
            </button>
          ))}
          <div className="mx-1 h-5 w-px bg-[#3A3A3C]" />
          {['전체', ...MAIN_PURPOSES].map((purpose) => (
            <button
              key={purpose}
              type="button"
              onClick={() => setPurposeFilter(purpose)}
              className={`h-8 rounded-[8px] px-3 text-[12px] font-semibold transition-colors ${purposeFilter === purpose ? 'bg-[#3A3A3C] text-white' : 'bg-[#1F1F1E] text-[#86868B] hover:text-white'}`}
            >
              {purpose}
            </button>
          ))}
          <div className="mx-1 h-5 w-px bg-[#3A3A3C]" />
          {['전체', ...MAIN_STATUSES].map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`h-8 rounded-[8px] px-3 text-[12px] font-semibold transition-colors ${statusFilter === status ? 'bg-[#3A3A3C] text-white' : 'bg-[#1F1F1E] text-[#86868B] hover:text-white'}`}
            >
              {status}
            </button>
          ))}
        </div>
        <div className="overflow-auto">
          <table className="w-full min-w-[1120px] text-left border-collapse">
            <thead className="bg-[#252524] text-[#86868B] text-[12px]">
              <tr>
                <th className="py-3 pl-4 pr-3 font-semibold">프로젝트</th>
                <th className="py-3 px-3 font-semibold">기능셀</th>
                <th className="py-3 px-3 font-semibold">등록자</th>
                <th className="py-3 px-3 font-semibold">내용</th>
                <th className="py-3 px-3 font-semibold">이해관계자</th>
                <th className="py-3 px-3 font-semibold">목적</th>
                <th className="py-3 px-3 font-semibold">진행상태</th>
                <th className="py-3 px-3 font-semibold">중요도</th>
                <th className="py-3 pr-4 pl-3 font-semibold">등록일</th>
              </tr>
            </thead>
            <tbody>
              {displayedLogs.map((item) => <MainWorklogRow key={item.id} item={item} />)}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-5 grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-4">
        <aside className="rounded-[24px] border border-[#333333] bg-[#252524] p-5">
          <SectionHeader eyebrow="WEEKLY STATUS" title="이번 주 공유 현황" />
          <div className="grid grid-cols-2 gap-3">
            {weeklySummary.map((item) => (
              <div key={item.label} className="rounded-[14px] border border-[#333333] bg-[#1F1F1E] px-4 py-3">
                <div className="text-[12px] text-[#86868B] font-semibold">{item.label}</div>
                <div className={`mt-1 text-[24px] font-semibold tracking-tight ${item.tone}`}>{item.value}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-[14px] border border-[#333333] bg-[#1F1F1E] p-4">
            <div className="text-[12px] font-bold text-[#86868B]">주요 이슈</div>
            <p className="mt-2 text-[14px] leading-6 text-[#D1D1D6] break-keep">
              Refi, Lease-up, EOD/경매, 유치권 등 이번 주 의사결정이 필요한 이슈를 업무 로그와 Weekly 탭에서 같이 추적합니다.
            </p>
            <button type="button" onClick={() => navigateTo(pathFor('dashboard/weekly'))} className="mt-4 h-9 w-full rounded-[8px] bg-[#30302F] text-[13px] font-semibold text-white hover:bg-[#3A3A3A]">
              Weekly 탭 보기
            </button>
          </div>
        </aside>

        <div className="rounded-[24px] border border-[#333333] bg-[#252524] p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h2 className="text-[18px] font-bold text-white">물류센터 주요 TASK 관리</h2>
              <span className="rounded-[8px] bg-[#333333] px-3 py-1 text-[12px] font-semibold text-[#D1D1D6]">26년 5월 3주</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-[10px] border border-[#333333] bg-[#1F1F1E] p-1">
                {MAIN_SORT_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setTaskSort(option.id)}
                    className={`h-8 rounded-[8px] px-3 text-[12px] font-semibold transition-colors ${taskSort === option.id ? 'bg-[#3A3A3C] text-white' : 'text-[#86868B] hover:text-white'}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => setShowAllTasks((value) => !value)} className="h-9 rounded-[8px] border border-[#333333] bg-[#1F1F1E] px-4 text-[13px] font-semibold text-[#D1D1D6] hover:text-white">
                {showAllTasks ? '접기' : '전체보기'}
              </button>
              <button type="button" onClick={() => navigateTo(pathFor('dashboard/home'))} className="h-9 rounded-[8px] border border-[#2C66A2] bg-[#17314E] px-4 text-[13px] font-semibold text-[#9AD7FF] hover:bg-[#1E3C5F]">
                Dashboard 보기
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {visibleTasks.map((task, index) => (
              <div key={task.id} className="group rounded-[22px] border border-[#3A3A3C] bg-[#272726] px-6 py-5 transition-colors hover:bg-[#30302F]">
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-[390px_1fr_190px] lg:items-start">
                  <div className="lg:border-r lg:border-[#444444]/60 lg:pr-7">
                    <div className="text-[13px] font-bold text-[#86868B]">Task {index + 1}</div>
                    <h3 className="mt-1 text-[21px] font-bold leading-tight tracking-tight text-[#E2AA29] break-keep">{task.taskName}</h3>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <StatusPill className={MAIN_STATUS_STYLES[task.status] || 'bg-[#262626] text-[#E5E5E5] border-[#3A3A3C]'}>{task.status}</StatusPill>
                      <span className={`inline-flex h-7 items-center text-[13px] font-bold ${MAIN_PRIORITY_STYLES[task.priority]}`}>{task.priority}</span>
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="text-[13px] font-bold text-[#86868B]">Next Action</span>
                      <span className="rounded-full border border-[#3A3A3C] bg-[#2C2C2E] px-2.5 py-1 text-[11px] font-medium text-[#A1A1AA]">마감일 목표 {task.dueDate}</span>
                    </div>
                    <p className="text-[17px] font-medium leading-7 text-[#BBB9AF] break-keep">{task.nextAction}</p>
                    <p className="mt-2 text-[13px] leading-6 text-[#86868B] break-keep">{task.issue}</p>
                  </div>
                  <div className="flex items-center justify-start gap-3 lg:justify-end">
                    <span className="text-[13px] font-medium text-[#86868B]">이해관계자</span>
                    <span className="rounded-[12px] border border-[#333333] bg-[#1A1A1A] px-4 py-2 text-[14px] font-bold text-white whitespace-nowrap">{task.stakeholder}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {[
          { title: '개인 업무', filter: '개인', rows: worklogs.filter((item) => item.owner === (memberInfo?.staff_name || '사용자')).slice(0, 3) },
          { title: '팀 업무', filter: '팀', rows: worklogs.filter((item) => item.cell !== '섹터PM').slice(0, 3) },
          { title: '섹터 업무', filter: '섹터', rows: worklogs.filter((item) => item.project.includes('물류센터')).slice(0, 3) },
        ].map((block) => (
          <div key={block.title} className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <SectionHeader eyebrow={block.filter.toUpperCase()} title={block.title} />
              <button type="button" onClick={() => setScopeFilter(block.filter)} className="h-8 rounded-[8px] bg-[#30302F] px-3 text-[12px] font-semibold text-[#D1D1D6] hover:text-white">보기</button>
            </div>
            <div className="space-y-3">
              {(block.rows.length ? block.rows : worklogs.slice(0, 2)).map((item) => (
                <div key={`${block.title}-${item.id}`} className="rounded-[12px] border border-[#333333] bg-[#1F1F1E] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-[14px] font-semibold leading-5 text-white break-keep">{item.title}</div>
                    <StatusPill className={MAIN_STATUS_STYLES[item.status] || 'bg-[#262626] text-[#E5E5E5] border-[#3A3A3C]'}>{item.status}</StatusPill>
                  </div>
                  <div className="mt-2 text-[12px] text-[#86868B]">{item.owner} · {item.purpose} · {item.date}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
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
    if (Math.abs(numeric) >= 100000000) return `${formatNumber(Math.round(numeric / 100000000))}억`;
    if (Math.abs(numeric) >= 10000) return `${formatNumber(Math.round(numeric / 10000))}만`;
    return formatNumber(Math.round(numeric));
  }
  if (valueType === 'area') return `${formatNumber(Math.round(numeric))}㎡`;
  if (valueType === 'percent') return `${(numeric * 100).toFixed(1)}%`;
  return formatNumber(Math.round(numeric));
}

function chartLabel(row, labelKey = 'label') {
  return cleanDisplay(row?.[labelKey] || row?.month || row?.assetName || row?.tenantMasterName || row?.label, '-');
}

function RichTrendChart({ rows, valueKey, secondaryKey, valueType = 'currency', labelKey = 'month', valueLabel, secondaryLabel }) {
  const points = (rows || []).filter((row) => row?.[valueKey] != null).slice(-18);
  if (!points.length) return <div className="text-[13px] text-[#86868B]">표시할 차트 데이터가 없습니다.</div>;
  const width = 820;
  const height = 270;
  const paddingLeft = 86;
  const paddingRight = 58;
  const paddingTop = 30;
  const paddingBottom = 62;
  const plotWidth = width - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;
  const maxValue = Math.max(...points.map((row) => Number(row[valueKey] || 0)), 1);
  const secondaryMax = Math.max(...points.map((row) => Number(row[secondaryKey] || 0)), 1);
  const yTicks = [1, 0.75, 0.5, 0.25, 0];
  const primaryName = valueLabel || chartMetricLabel(valueKey, valueType);
  const secondaryName = secondaryLabel || chartMetricLabel(secondaryKey, 'number');
  const coords = points.map((row, index) => {
    const x = paddingLeft + (index * plotWidth) / Math.max(points.length - 1, 1);
    const y = paddingTop + (1 - Number(row[valueKey] || 0) / maxValue) * plotHeight;
    const y2 = paddingTop + (1 - Number(row[secondaryKey] || 0) / secondaryMax) * plotHeight;
    return { x, y, y2, row };
  });
  return (
    <div className="rounded-[14px] border border-[#333333] bg-[#1F1F1E] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="text-[12px] text-[#86868B]">
          X축: 월별 기간 · 왼쪽 Y축: {primaryName} · 오른쪽 Y축: {secondaryName}
        </div>
        <div className="flex flex-wrap items-center gap-4 text-[12px] text-[#D1D1D6]">
          <span><span className="mr-1 inline-block h-[3px] w-5 bg-[#9AD7FF] align-middle" />{primaryName}</span>
          {secondaryKey && <span><span className="mr-1 inline-block h-[3px] w-5 bg-[#B5E48C] align-middle" />{secondaryName}</span>}
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[260px]" role="img" aria-label={`${primaryName} 추이 차트`}>
        {yTicks.map((tick) => {
          const y = paddingTop + (1 - tick) * plotHeight;
          return (
            <g key={tick}>
              <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="#303033" strokeDasharray="3 5" />
              <text x={paddingLeft - 10} y={y + 4} textAnchor="end" fill="#A1A1AA" fontSize="11">{shortChartValue(maxValue * tick, valueType)}</text>
              {secondaryKey && <text x={width - paddingRight + 10} y={y + 4} fill="#8AAE76" fontSize="11">{shortChartValue(secondaryMax * tick, 'number')}</text>}
            </g>
          );
        })}
        <line x1={paddingLeft} y1={paddingTop} x2={paddingLeft} y2={paddingTop + plotHeight} stroke="#4A4A4D" />
        <line x1={width - paddingRight} y1={paddingTop} x2={width - paddingRight} y2={paddingTop + plotHeight} stroke="#3A3A3C" />
        <line x1={paddingLeft} y1={paddingTop + plotHeight} x2={width - paddingRight} y2={paddingTop + plotHeight} stroke="#4A4A4D" />
        <polyline points={coords.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke="#9AD7FF" strokeWidth="3" />
        {secondaryKey && <polyline points={coords.map((point) => `${point.x},${point.y2}`).join(' ')} fill="none" stroke="#B5E48C" strokeWidth="2.5" strokeDasharray="6 5" />}
        {coords.map((point, index) => {
          const label = chartLabel(point.row, labelKey);
          const showLabel = points.length <= 10 || index % Math.ceil(points.length / 8) === 0 || index === points.length - 1;
          return (
            <g key={`${label}-${point.x}`}>
              <line x1={point.x} y1={paddingTop + plotHeight} x2={point.x} y2={paddingTop + plotHeight + 5} stroke="#4A4A4D" />
              {showLabel && <text x={point.x} y={height - 34} textAnchor="middle" fill="#A1A1AA" fontSize="11">{label}</text>}
              <circle cx={point.x} cy={point.y} r="5" fill="#9AD7FF" stroke="#111" strokeWidth="1.5">
                <title>{`${label}\n${primaryName}: ${formatMetric(point.row[valueKey], valueType)}${secondaryKey ? `\n${secondaryName}: ${formatNumber(point.row[secondaryKey])}` : ''}`}</title>
              </circle>
              {secondaryKey && (
                <circle cx={point.x} cy={point.y2} r="4" fill="#B5E48C" stroke="#111" strokeWidth="1.2">
                  <title>{`${label}\n${secondaryName}: ${formatNumber(point.row[secondaryKey])}\n${primaryName}: ${formatMetric(point.row[valueKey], valueType)}`}</title>
                </circle>
              )}
            </g>
          );
        })}
        <text x={paddingLeft} y={height - 10} fill="#86868B" fontSize="11">마우스를 점에 올리면 해당 월의 세부값이 표시됩니다.</text>
      </svg>
    </div>
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

function loadNaverMapsSdk() {
  if (typeof window === 'undefined') return Promise.reject(new Error('browser unavailable'));
  if (!NAVER_MAPS_CLIENT_ID) return Promise.reject(new Error('NAVER_MAPS_CLIENT_ID missing'));
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
    script.async = true;
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(NAVER_MAPS_CLIENT_ID)}`;
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

    loadNaverMapsSdk()
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
      <div className="relative rounded-[14px] border border-[#333333] bg-[#1F1F1E] overflow-hidden" style={{ height: 420 }}>
        <div ref={containerRef} className="logistics-map-canvas [&_img]:!max-w-none [&_*]:box-content" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} aria-label="동적 지도" />
        {mode !== 'leaflet' && mode !== 'naver' ? <PortfolioMapSchematic points={validPoints} /> : null}
        <div className={`absolute left-3 top-3 rounded-full border px-3 py-1 text-[12px] font-semibold ${mode === 'leaflet' || mode === 'naver' ? 'border-[#2E6B45] bg-[#173522] text-[#B5E48C]' : 'border-[#7A6425] bg-[#2B2613] text-[#FFD166]'}`}>
          {status}
        </div>
      </div>
      <div className="text-[12px] text-[#86868B]">
        지도 제공: Naver Maps 우선, 인증 실패 시 OpenStreetMap 동적 지도 대체.
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
  const home = homeData;
  const data = useMemo(() => normalizeHomeData(home), [home]);
  const [modal, setModal] = useState(null);
  const [tenantSort, setTenantSort] = useState('cost');

  const rentTrendRows = (home.rentTrend || []).map((row) => ({
    ...row,
    monthlyCostTotalAdjusted: firstDefined(row.monthlyCostTotalAdjusted, row.monthlyTotal, row.monthlyRentTotal),
    activeAssetCount: firstDefined(row.activeAssetCount, 0),
  }));
  const sortedTenants = data.topTenants.slice().sort((a, b) => (
    tenantSort === 'area'
      ? Number(b.leasedAreaSqm || 0) - Number(a.leasedAreaSqm || 0)
      : Number(b.monthlyCombinedTotal || 0) - Number(a.monthlyCombinedTotal || 0)
  ));
  const mapAssetRows = data.mapPoints.map((point) => ({
    ...point,
    ...(data.vacancyRows.find((row) => row.assetId === point.assetId) || {}),
  }));
  const coordinateRows = data.mapPoints.map((row, index) => [
    formatNumber(index + 1),
    row.assetName,
    row.address || '-',
    row.latitude != null && row.longitude != null ? `${row.latitude}, ${row.longitude}` : '-',
  ]);
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

  const openTableModal = (title, headers, rows) => setModal({ title, headers, rows });
  const openTenantModal = (tenant, title) => openTableModal(title, ['항목', '내용'], [
    ['임차인명', tenant.tenantMasterName],
    ['자산 수', formatNumber(tenant.assetCount || tenant.assetNames?.length || 0)],
    ['임대면적', formatArea(tenant.leasedAreaSqm)],
    ['월 임대료', formatCurrency(tenant.monthlyRentTotal)],
    ['월 관리비', formatCurrency(tenant.monthlyMfTotal)],
    ['월 임관리비', formatCurrency(tenant.monthlyCombinedTotal)],
    ['최근 만기일', formatDate(tenant.latestExpiry || tenant.currentEndDate)],
    ['사업자번호', tenant.businessRegistrationNo || tenant.company?.businessRegistrationNo || '-'],
  ]);

  const kpiCards = [
    ['운영 자산 수', formatMetric(data.operatingAssetCount, 'number'), () => openTableModal('운영 자산 목록', ['자산명', '주소', '연면적', '공실률'], mapAssetRows.map((row) => [row.assetName, row.address || '-', formatArea(row.grossFloorAreaSqm), formatPercent(row.vacancyRate)]))],
    ['총 임대면적', formatMetric(data.leasedArea, 'area'), () => openTableModal('총 임대면적 근거', ['자산명', '연면적', '공실면적', '공실률'], data.vacancyRows.map((row) => [row.assetName, formatArea(row.grossFloorAreaSqm), formatArea(row.vacancyAreaSqm), formatPercent(row.vacancyRate)]))],
    ['총 공실면적', formatMetric(data.vacancyArea, 'area'), () => openTableModal('총 공실면적 근거', ['자산명', '공실면적', '공실률'], data.vacancyRows.map((row) => [row.assetName, formatArea(row.vacancyAreaSqm), formatPercent(row.vacancyRate)]))],
    ['공실률', formatMetric(data.vacancyRate, 'percent'), () => openTableModal('공실률 계산 근거', ['항목', '내용'], [['연면적', formatArea(data.occupancy.grossFloorAreaSqm)], ['임대면적', formatArea(data.occupancy.leasedAreaSqm)], ['공실면적', formatArea(data.occupancy.vacancyAreaSqm)], ['공실률', formatPercent(data.vacancyRate)]])],
    ['월 임관리비 총액', formatMetric(data.monthlyCost, 'currency'), () => openTableModal('월 임관리비 총액 근거', ['임차인명', '월 임대료', '월 관리비', '월 임관리비'], data.topContracts.map((row) => [row.tenantMasterName, formatCurrency(row.monthlyRentTotal), formatCurrency(row.monthlyMfTotal), formatCurrency(row.monthlyCombinedTotal)]))],
  ];
  const snapshotCards = [
    ['운영 자산 수', `${formatNumber(data.operatingAssetCount)}개`, () => openTableModal('운영 자산 수 근거', ['자산명', '주소', '연면적', '공실면적', '공실률'], mapAssetRows.map((row) => [row.assetName, row.address || '-', formatArea(row.grossFloorAreaSqm), formatArea(row.vacancyAreaSqm), formatPercent(row.vacancyRate)]))],
    ['현재 공실률', formatPercent(data.vacancyRate), () => openTableModal('현재 공실률 근거', ['항목', '내용'], [['연면적', formatArea(data.occupancy.grossFloorAreaSqm)], ['임대면적', formatArea(data.occupancy.leasedAreaSqm)], ['공실면적', formatArea(data.occupancy.vacancyAreaSqm)], ['공실률', formatPercent(data.vacancyRate)]])],
    ['표시 임차인 수', `${formatNumber(home.contractSummary?.tenantCount || data.topTenants.length)}개`, () => openTableModal('표시 임차인 수 근거', ['임차인명', '자산 수', '임대면적', '월 임관리비'], data.topContracts.map((row) => [row.tenantMasterName, formatNumber(row.assetNames?.length || row.assetCount || 0), formatArea(row.leasedAreaSqm), formatCurrency(row.monthlyCombinedTotal)]))],
    ['좌표 보유 자산', `${formatNumber(data.mapPoints.length)}개`, () => openTableModal('좌표 보유 자산 근거', ['No.', '자산명', '주소', '좌표'], coordinateRows)],
  ];

  return (
    <div className="space-y-6">
      <LogisticsModal modal={modal} onClose={() => setModal(null)} />
      <section className="grid grid-cols-1 md:grid-cols-5 gap-3">
        {kpiCards.map(([label, value, action]) => (
          <button key={label} type="button" onClick={action} className="text-left rounded-[14px] border border-[#333333] bg-[#252524] px-4 py-4 hover:bg-[#2A2A29]">
            <div className="text-[12px] text-[#86868B] font-semibold">{label}</div>
            <div className="text-[22px] text-white font-semibold mt-2">{value}</div>
          </button>
        ))}
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-5">
        <div className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
          <SectionHeader
            eyebrow="LOCATION"
            title="포트폴리오 위치"
            right={(
              <div className="flex gap-2">
                <button type="button" onClick={() => setModal({ title: '포트폴리오 위치', content: <div className="space-y-4"><PortfolioMapPlot points={data.mapPoints} /><DataTable headers={['No.', '자산명', '주소', '좌표']} rows={coordinateRows} compact /></div> })} className="h-9 px-3 rounded-[8px] bg-white text-[#1F1F1E] text-[13px] font-semibold hover:bg-[#E5E5E5]">지도 크게 보기</button>
                <button type="button" onClick={() => openTableModal('좌표 보유 자산 목록', ['No.', '자산명', '주소', '좌표'], coordinateRows)} className="h-9 px-3 rounded-[8px] bg-[#30302F] text-white text-[13px] font-semibold hover:bg-[#3A3A3A]">좌표 표</button>
              </div>
            )}
          />
          <div className="mb-4">
            <PortfolioMapPlot points={data.mapPoints} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {data.mapPoints.map((point, index) => (
              <button key={point.assetId} type="button" onClick={() => openTableModal(`자산 위치 · ${point.assetName}`, ['항목', '내용'], [['자산명', point.assetName], ['주소', point.address || '-'], ['좌표', point.latitude != null && point.longitude != null ? `${point.latitude}, ${point.longitude}` : '-'], ['이슈 수', formatNumber(point.issueCount)]])} className="text-left rounded-[12px] border border-[#333333] bg-[#1F1F1E] p-3 hover:bg-[#2A2A29]">
                <div className="text-[12px] text-[#86868B]">{String(index + 1).padStart(2, '0')}</div>
                <div className="text-[14px] text-white font-semibold mt-1">{point.assetName}</div>
                <div className="text-[12px] text-[#86868B] mt-1 line-clamp-1">{point.address || '-'}</div>
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
          <SectionHeader eyebrow="SNAPSHOT" title="포트폴리오 스냅샷" />
          <div className="grid grid-cols-2 gap-3">
            {snapshotCards.map(([label, value, action]) => (
              <button key={label} type="button" onClick={action} className="text-left rounded-[14px] border border-[#333333] bg-[#1F1F1E] px-4 py-4 hover:bg-[#2A2A29]">
                <div className="text-[12px] text-[#86868B] font-semibold">{label}</div>
                <div className="text-[24px] text-white font-semibold mt-2">{value}</div>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
        <SectionHeader
          eyebrow="TREND"
          title="임대료 추이"
          right={<button type="button" onClick={() => openTableModal('임대료 추이 원본 표', ['월', '월 임대료(RF/FO 반영)', '월 관리비', '월 임관리비(RF/FO 반영)', '원 월임대료', '원 월관리비', '원 월임관리비', '자산 수', '총 연면적', '신규 편입 자산'], rentTrendRows.map((row) => [row.month, formatCurrency(row.monthlyRentTotalAdjusted), formatCurrency(row.monthlyMfTotalAdjusted), formatCurrency(row.monthlyCostTotalAdjusted), formatCurrency(row.monthlyRentTotal), formatCurrency(row.monthlyMfTotal), formatCurrency(row.monthlyTotal), formatNumber(row.activeAssetCount), formatArea(row.grossFloorAreaSqm), (row.newlyAddedAssets || []).map((asset) => asset.assetName).join(', ') || '-']))} className="h-9 px-3 rounded-[8px] bg-[#30302F] text-white text-[13px] font-semibold hover:bg-[#3A3A3A]">원본 표 보기</button>}
        />
        <RichTrendChart rows={rentTrendRows} valueKey="monthlyCostTotalAdjusted" secondaryKey="activeAssetCount" valueLabel="월 임관리비 합계" secondaryLabel="운영 자산 수" />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
          <SectionHeader eyebrow="VACANCY" title="공실 요약" />
          <DataTable headers={['자산명', '연면적', '공실면적', '공실률']} rows={data.vacancyRows.map((row) => [row.assetName, formatArea(row.grossFloorAreaSqm), formatArea(row.vacancyAreaSqm), formatPercent(row.vacancyRate)])} compact />
        </div>
        <div className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
          <SectionHeader
            eyebrow="EXPIRY"
            title="만기 집중도"
            right={<button type="button" onClick={() => openTableModal('만기 집중도 월별 상세', ['만기월', '임차인', '자산', '임대면적', '월 임대료', '월 관리비', '월 임관리비', '평당 월 임대료', '평당 월 관리비', 'E.NOC', '공간'], expiryDetailRows)} className="h-9 px-3 rounded-[8px] bg-[#30302F] text-white text-[13px] font-semibold hover:bg-[#3A3A3A]">월별 상세 보기</button>}
          />
          <RichTrendChart rows={data.monthlyExpiryRows} valueKey="expiringAreaSqm" secondaryKey="uniqueTenantCount" valueType="area" valueLabel="만기 예정 임대면적" secondaryLabel="임차인 수" />
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
          <SectionHeader
            eyebrow="TENANTS"
            title="상위 임차인"
            right={(
              <div className="flex rounded-[8px] border border-[#3A3A3C] bg-[#1F1F1E] p-1">
                {[
                  ['cost', '임관리비 합계'],
                  ['area', '임대면적'],
                ].map(([value, label]) => (
                  <button key={value} type="button" onClick={() => setTenantSort(value)} className={`h-8 px-3 rounded-[6px] text-[13px] font-semibold ${tenantSort === value ? 'bg-white text-[#1F1F1E]' : 'text-[#A1A1AA] hover:text-white'}`}>{label}</button>
                ))}
              </div>
            )}
          />
          <DataTable headers={['임차인명', '임대면적(㎡)', '월 임대료', '월 관리비', '월 임관리비']} rows={sortedTenants.map((row) => [row.tenantMasterName, formatArea(row.leasedAreaSqm), formatCurrency(row.monthlyRentTotal), formatCurrency(row.monthlyMfTotal), formatCurrency(row.monthlyCombinedTotal)])} onRowClick={(index) => openTenantModal(sortedTenants[index], '임차인 상세')} compact />
        </div>
        <div className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
          <SectionHeader eyebrow="CONTRACTS" title="주요 임차인 계약 요약" />
          <DataTable headers={['임차인명', '자산 수', '자산 목록', '임대면적(㎡)', '월 임관리비', '최근 만기일']} rows={data.topContracts.map((row) => [row.tenantMasterName, formatNumber(row.assetNames?.length || 0), row.assetNames.join(', '), formatArea(row.leasedAreaSqm), formatCurrency(row.monthlyCombinedTotal), formatDate(row.currentEndDate)])} onRowClick={(index) => openTenantModal(data.topContracts[index], '임차인 계약 상세')} compact />
        </div>
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
          <button key={`${row[labelKey]}-${valueKey}`} type="button" onClick={onClick} className="w-full text-left group">
            <div className="flex items-center justify-between gap-3 text-[12px]">
              <span className="text-[#C7C7CC] font-semibold truncate">{row[labelKey] || '-'}</span>
              <span className="text-[#86868B]">{formatMetric(value, valueType)}</span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-[#1F1F1E] overflow-hidden">
              <div className="h-full rounded-full bg-[#9AD7FF] group-hover:bg-[#B5E48C]" style={{ width: `${Math.max(4, (value / maxValue) * 100)}%` }} />
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
  const chartRows = (rows || []).filter((row) => Number(row?.[valueKey] || 0) > 0).slice(0, 10);
  const maxValue = Math.max(...chartRows.map((row) => Number(row[valueKey] || 0)), 1);
  const metricName = valueLabel || chartMetricLabel(valueKey, valueType);
  if (!chartRows.length) return <div className="text-[13px] text-[#86868B]">차트로 표시할 값이 없습니다.</div>;
  return (
    <div className="rounded-[14px] border border-[#333333] bg-[#1F1F1E] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-[12px]">
        <span className="text-[#86868B]">Y축: 항목 · X축: {metricName}</span>
        <span className="text-[#D1D1D6]"><span className="mr-1 inline-block h-2 w-6 rounded-full bg-[#9AD7FF]" />막대 길이 = {metricName}</span>
      </div>
      <div className="space-y-3">
        {chartRows.map((row) => {
          const value = Number(row[valueKey] || 0);
          const label = chartLabel(row, labelKey);
          return (
            <button key={`${label}-${valueKey}`} type="button" onClick={onClick} className="group relative w-full rounded-[10px] px-2 py-1.5 text-left hover:bg-[#282827]">
              <div className="grid grid-cols-[168px_1fr_108px] items-center gap-3 text-[12px]">
                <span className="truncate font-semibold text-[#E5E5E5]" title={label}>{label}</span>
                <div className="relative h-5 rounded-full bg-[#151515]">
                  <div className="h-full rounded-full bg-[#9AD7FF] transition-colors group-hover:bg-[#B5E48C]" style={{ width: `${Math.max(3, (value / maxValue) * 100)}%` }} />
                  <div className="pointer-events-none absolute left-2 top-1/2 hidden -translate-y-1/2 rounded-[8px] border border-[#3A3A3C] bg-[#252524] px-3 py-2 text-[12px] text-white shadow-xl group-hover:block">
                    <div className="font-semibold">{label}</div>
                    <div className="mt-1 text-[#A1A1AA]">{metricName}: {formatMetric(value, valueType)}</div>
                    <div className="text-[#86868B]">전체 최대값 대비 {((value / maxValue) * 100).toFixed(1)}%</div>
                  </div>
                </div>
                <span className="text-right font-semibold text-[#D1D1D6]">{formatMetric(value, valueType)}</span>
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
          return (
            <div key={row[labelKey]} className="flex-1 min-w-[7px] flex flex-col justify-end gap-[2px]" title={`${row[labelKey]} · 임대료 ${formatCurrency(rent)} · 관리비 ${formatCurrency(mf)}`}>
              <div className="rounded-t-[3px] bg-[#B5E48C]" style={{ height: `${Math.max(2, (mf / maxValue) * 170)}px` }} />
              <div className="rounded-t-[3px] bg-[#9AD7FF]" style={{ height: `${Math.max(2, (rent / maxValue) * 170)}px` }} />
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
      eNoc: firstDefined(row.eNoc, row.averageENoc),
    };
  });
  return {
    ...payload,
    normalizedRows: rows,
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
    ['사업자번호', firstDefined(company.businessRegistrationNo, profile.businessRegistrationNo, '-')],
    ['법인등록번호', company.corpRegistrationNo || '-'],
    ['DART corp code', company.dartCorpCode || '-'],
    ['매칭 상태', company.matchStatus || '-'],
    ['업종', company.industryCode || '-'],
    ['본점소재지', company.headquartersAddress || '-'],
    ['상장여부', company.listedYn || '-'],
    ['그룹명', company.groupName || '-'],
    ['최근 재무제표 연도', company.latestFinancialYear || '-'],
    ['재무 구분', company.financialStatementType || '-'],
    ['사용한 보고서', company.latestReportName || '-'],
    ['접수번호', company.latestReceiptNo || '-'],
    ['최근 매출', formatCurrency(firstDefined(financials.revenue, company.latestRevenue))],
    ['영업이익', formatCurrency(firstDefined(financials.operatingIncome, company.latestOperatingIncome))],
    ['부채비율', firstDefined(financials.debtRatio, company.latestDebtRatio) == null ? '-' : `${formatNumber(firstDefined(financials.debtRatio, company.latestDebtRatio))}%`],
    ['직원수', firstDefined(financials.employeeCount, company.latestEmployeeCount) == null ? '-' : `${formatNumber(firstDefined(financials.employeeCount, company.latestEmployeeCount))}명`],
    ['DART 적재일', formatDate(firstDefined(financials.fetchedAt, company.fetchedAt))],
    ['검토 메모', firstDefined(financials.reviewNote, company.reviewNote, financials.emptyStateMessage, '-')],
  ];
}

function SectorDashboard() {
  const sector = sectorData;
  const [modal, setModal] = useState(null);
  const kpis = sector.kpis || {};
  const topAssets = sector.rankings?.assetsByRent || [];
  const topTenants = sector.rankings?.tenantsByRent || [];
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
            ['DART corp code', row.company?.dartCorpCode || '-'],
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

      <section className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-5">
        <main className="space-y-5">
          <div className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
            <SectionHeader eyebrow="REGION" title="권역별 노출도" right={<button type="button" onClick={() => openTableModal('권역별 노출도 원본 표', ['권역', '자산 수', '임대면적', '월 임관리비', '공실률'], regionTableRows)} className="h-9 px-3 rounded-[8px] bg-[#30302F] text-white text-[13px] font-semibold hover:bg-[#3A3A3A]">원본 표 보기</button>} />
            <RichBarChart rows={regionRows.map((row) => ({ ...row, value: firstDefined(row.monthlyCostTotal, row.assetCount) }))} labelKey="label" valueKey="value" valueType="currency" valueLabel="권역별 월 임관리비 합계" onClick={() => openTableModal('권역별 노출도 원본 표', ['권역', '자산 수', '임대면적', '월 임관리비', '공실률'], regionTableRows)} />
          </div>

          <section className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <div className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
              <SectionHeader eyebrow="TREND" title="월 임관리비 추이" />
              <RichStackedPeriodChart rows={monthlyRentRows} series={[{ key: 'monthlyRentTotal' }, { key: 'monthlyMfTotal' }]} onClick={() => openTableModal('월 임관리비 추이 원본 표', ['월', '월 임대료', '월 관리비'], trendTableRows)} />
            </div>
            <div className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
              <SectionHeader eyebrow="ASSETS" title="자산 랭킹" />
              <DataTable headers={['자산명', '월 임관리비', '공실률']} rows={assetTableRows} onRowClick={(index) => openAssetDetail(topAssets[index])} compact />
            </div>
          </section>

          <div className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
            <SectionHeader eyebrow="TENANTS" title="임차인 랭킹" />
            <DataTable headers={['임차인명', '월 임대료', '월 관리비', '월 임관리비', '임대면적']} rows={tenantTableRows} onRowClick={(index) => openTenantDetail(byMonthlyCost[index])} compact />
          </div>
        </main>

        <aside className="space-y-5">
          <div className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
            <SectionHeader eyebrow="TOP" title="Top 자산" />
            <div className="space-y-2">
              {topAssets.slice(0, 5).map((row) => (
                <button key={row.assetId || row.assetName} type="button" onClick={() => openAssetDetail(row)} className="w-full text-left rounded-[12px] border border-[#333333] bg-[#1F1F1E] p-4 hover:bg-[#2A2A29]">
                  <div className="text-[14px] text-white font-semibold">{row.assetName}</div>
                  <div className="text-[12px] text-[#86868B] mt-1">{formatCurrency(firstDefined(row.monthlyCostTotal, Number(row.monthlyRentTotal || 0) + Number(row.monthlyMfTotal || 0)))} · 공실률 {formatPercent(row.vacancyRate)}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
            <SectionHeader eyebrow="TOP" title="Top 임차인" />
            <div className="space-y-2">
              {byMonthlyCost.slice(0, 5).map((row) => (
                <button key={row.tenantId || row.tenantMasterName} type="button" onClick={() => openTenantDetail(row)} className="w-full text-left rounded-[12px] border border-[#333333] bg-[#1F1F1E] p-4 hover:bg-[#2A2A29]">
                  <div className="text-[14px] text-white font-semibold">{row.tenantMasterName}</div>
                  <div className="text-[12px] text-[#86868B] mt-1">{formatCurrency(row.monthlyTotalCost)} · {formatArea(row.leasedAreaSqm)}</div>
                </button>
              ))}
            </div>
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
  const defaultTenantId = companyOptionsData[0]?.tenantId || Object.keys(COMPANY_PAYLOADS)[0];
  const [selectedTenantId, setSelectedTenantId] = useState(defaultTenantId);
  const [exposureMode, setExposureMode] = useState('cost');
  const [modal, setModal] = useState(null);
  const rawPayload = COMPANY_PAYLOADS[selectedTenantId] || COMPANY_PAYLOADS[defaultTenantId] || Object.values(COMPANY_PAYLOADS)[0];
  const company = useMemo(() => normalizeCompanyPayload(rawPayload || {}), [rawPayload]);
  const profile = company.profile || {};
  const financials = company.financials || {};
  const leasedAssets = company.normalizedLeasedAssets || [];
  const mapPoints = company.normalizedMapPoints || [];
  const mappedPointCount = mapPoints.filter((row) => Number.isFinite(Number(row.latitude)) && Number.isFinite(Number(row.longitude))).length;
  const kpiLookup = Object.fromEntries((company.kpis || []).map((item) => [item.key, item]));
  const kpis = [
    { key: 'asset_count', label: '임차 자산 수', value: profile.assetCount, valueType: 'number' },
    { key: 'leased_area', label: '총 임차면적', value: profile.leasedAreaSqm, valueType: 'area' },
    { key: 'monthly_total_cost', label: '월 임관리비 총액', value: profile.monthlyCostTotal, valueType: 'currency' },
    { key: 'monthly_rent_total', label: '월 임대료 총액', value: profile.monthlyRentTotal, valueType: 'currency' },
    { key: 'monthly_mf_total', label: '월 관리비 총액', value: profile.monthlyMfTotal, valueType: 'currency' },
  ].map((item) => ({ ...item, ...(kpiLookup[item.key] || {}) }));
  const exposureSourceRows = company.exposureRows || [];
  const hasCostExposure = exposureSourceRows.some((row) => Number(firstDefined(row.monthlyCostTotal, row.monthlyCombinedTotal)) > 0);
  const effectiveExposureMode = exposureMode === 'cost' && !hasCostExposure ? 'area' : exposureMode;
  const exposureRows = exposureSourceRows.map((row) => ({
    ...row,
    value: effectiveExposureMode === 'area' ? row.leasedAreaSqm : firstDefined(row.monthlyCostTotal, row.monthlyCombinedTotal),
  })).sort((a, b) => Number(b.value || 0) - Number(a.value || 0));
  const leasedAssetHeaders = ['자산명', '층/세부구역', '임대면적(㎡)', '임대면적(평)', '월 임대료', '월 관리비', '월 임관리비', '현재 계약만기일'];
  const leasedAssetRows = leasedAssets.map((row) => [
    row.assetName,
    row.spaceLabel,
    formatArea(row.leasedAreaSqm),
    formatNumber(row.leasedAreaPy),
    formatCurrency(row.monthlyRentTotal),
    formatCurrency(row.monthlyMfTotal),
    formatCurrency(row.monthlyCostTotal),
    formatDate(row.latestExpiry),
  ]);
  const exposureTableRows = exposureRows.map((row) => [
    row.assetName || row.label,
    formatArea(row.leasedAreaSqm),
    formatCurrency(row.monthlyRentTotal),
    formatCurrency(row.monthlyMfTotal),
    formatCurrency(row.monthlyCostTotal),
  ]);
  const openTableModal = (title, headers, rows) => setModal({ title, headers, rows });
  const openAssetExposureDetail = (row) => setModal({
    title: `자산 노출 상세 · ${row.assetName || '-'}`,
    headers: ['항목', '내용'],
    rows: [
      ['자산명', row.assetName || '-'],
      ['층/세부구역', row.spaceLabel || '-'],
      ['임대면적', formatArea(row.leasedAreaSqm)],
      ['임대면적(평)', formatNumber(row.leasedAreaPy)],
      ['월 임대료', formatCurrency(row.monthlyRentTotal)],
      ['월 관리비', formatCurrency(row.monthlyMfTotal)],
      ['월 임관리비', formatCurrency(row.monthlyCostTotal)],
      ['현재 계약만기일', formatDate(row.latestExpiry)],
      ['주소', row.address || '-'],
    ],
  });
  const openKpiModal = (item) => {
    if (item.key === 'asset_count') {
      openTableModal('임차 자산 수', ['자산명', '층/세부구역', '임대면적', '월 임관리비', '최근 만기일'], leasedAssets.map((row) => [
        row.assetName,
        row.spaceLabel,
        formatArea(row.leasedAreaSqm),
        formatCurrency(row.monthlyCostTotal),
        formatDate(row.latestExpiry),
      ]));
      return;
    }
    openTableModal(item.label, ['항목', '내용'], [
      ['기업명', profile.tenantMasterName || '-'],
      ['값', formatMetric(item.value, item.valueType)],
      ['DART 연결', financials.dartLinked ? '연결됨' : '미연결'],
      ['상태', item.status || '-'],
    ]);
  };

  return (
    <div className="space-y-6">
      <LogisticsModal modal={modal} onClose={() => setModal(null)} />
      <section className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
        <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-5">
          <div>
            <div className="text-[12px] text-[#86868B] font-semibold">기업 개요</div>
            <h3 className="text-[26px] text-white font-semibold mt-1">{profile.tenantMasterName || '기업'}</h3>
            <p className="text-[13px] text-[#A1A1AA] mt-2">{profile.businessRegistrationNo || '사업자번호 미입력'} · {financials.dartLinked ? 'DART 연결됨' : 'DART 미연결'}</p>
          </div>
          <select value={selectedTenantId} onChange={(event) => setSelectedTenantId(event.target.value)} className="h-10 min-w-[280px] rounded-[8px] border border-[#3A3A3C] bg-[#1F1F1E] px-3 text-[13px] text-white">
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

      <section className="grid grid-cols-1 md:grid-cols-5 gap-3">
        {[
          ['대상', profile.tenantMasterName || '-'],
          ['기준시점', company.basisDisplay?.asOf || company.generatedAt || '-'],
          ['계약/금액', 'DB_일반 + DB_히스토리'],
          ['DART', financials.fetchedAt ? formatDate(financials.fetchedAt) : (financials.dartLinked ? '연결됨' : '미연결')],
          ['지도', `${formatNumber(mappedPointCount)} / ${formatNumber(mapPoints.length)}개 좌표`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-[14px] border border-[#333333] bg-[#1F1F1E] px-4 py-4">
            <div className="text-[12px] text-[#86868B] font-semibold">{label}</div>
            <div className="text-[16px] text-white font-semibold mt-2">{value}</div>
          </div>
        ))}
      </section>

      <section className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
        <SectionHeader eyebrow="LEASED ASSETS" title="임차 자산 현황" right={<button type="button" onClick={() => openTableModal('임차 자산 현황', leasedAssetHeaders, leasedAssetRows)} className="h-9 px-3 rounded-[8px] bg-[#30302F] text-white text-[13px] font-semibold hover:bg-[#3A3A3A]">원본 표 보기</button>} />
        <DataTable headers={leasedAssetHeaders} rows={leasedAssetRows} onRowClick={(index) => openAssetExposureDetail(leasedAssets[index])} compact />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-5">
        <div className="space-y-5">
          <div className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
            <SectionHeader eyebrow="MAP" title="회사별 임차 자산 지도" right={<button type="button" onClick={() => setModal({ title: '포트폴리오 위치', content: <div className="space-y-4"><PortfolioMapPlot points={mapPoints} /><DataTable headers={['자산명', '주소', '좌표']} rows={mapPoints.map((row) => [row.assetName, row.address || '-', `${row.latitude || '-'}, ${row.longitude || '-'}`])} compact /></div> })} className="h-9 px-3 rounded-[8px] bg-white text-[#1F1F1E] text-[13px] font-semibold hover:bg-[#E5E5E5]">지도 크게 보기</button>} />
            <PortfolioMapPlot points={mapPoints} />
          </div>
          <div className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
            <SectionHeader
              eyebrow="EXPOSURE"
              title="자산별 노출도"
              right={(
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setExposureMode('cost')} className={`h-9 px-3 rounded-[8px] text-[13px] font-semibold ${effectiveExposureMode === 'cost' ? 'bg-white text-[#1F1F1E]' : 'bg-[#30302F] text-white hover:bg-[#3A3A3A]'}`}>임관리비 총합 기준</button>
                  <button type="button" onClick={() => setExposureMode('area')} className={`h-9 px-3 rounded-[8px] text-[13px] font-semibold ${effectiveExposureMode === 'area' ? 'bg-white text-[#1F1F1E]' : 'bg-[#30302F] text-white hover:bg-[#3A3A3A]'}`}>임대면적 기준</button>
                  <button type="button" onClick={() => openTableModal('자산별 노출도', ['자산명', '임대면적', '월 임대료', '월 관리비', '월 임관리비'], exposureTableRows)} className="h-9 px-3 rounded-[8px] bg-[#30302F] text-white text-[13px] font-semibold hover:bg-[#3A3A3A]">원본 표 보기</button>
                </div>
              )}
            />
            <RichBarChart rows={exposureRows} labelKey="label" valueKey="value" valueType={effectiveExposureMode === 'area' ? 'area' : 'currency'} valueLabel={effectiveExposureMode === 'area' ? '자산별 임대면적' : '자산별 월 임관리비'} onClick={() => openTableModal('자산별 노출도', ['자산명', '임대면적', '월 임대료', '월 관리비', '월 임관리비'], exposureTableRows)} />
            {!hasCostExposure && exposureMode === 'cost' ? <div className="mt-2 text-[12px] text-[#86868B]">월 임관리비 값이 비어 있어 임대면적 기준으로 표시했습니다.</div> : null}
          </div>
        </div>

        <div className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
          <SectionHeader eyebrow="DART" title="DART 상세 정보" />
          <DataTable headers={['항목', '값']} rows={companyDartRows(profile, financials)} compact />
          {financials.emptyStateMessage ? <div className="mt-4 rounded-[12px] border border-[#3A3A3C] bg-[#1F1F1E] p-3 text-[13px] text-[#C7C7CC]">{financials.emptyStateMessage}</div> : null}
        </div>
      </section>
    </div>
  );
}

function AssetDashboard() {
  const defaultAssetId = assetOptionsData[0]?.assetId || Object.keys(ASSET_PAYLOADS)[0];
  const [selectedAssetId, setSelectedAssetId] = useState(defaultAssetId);
  const [modal, setModal] = useState(null);
  const rawPayload = ASSET_PAYLOADS[selectedAssetId] || ASSET_PAYLOADS[defaultAssetId] || Object.values(ASSET_PAYLOADS)[0];
  const asset = useMemo(() => normalizeAssetPayload(rawPayload || {}), [rawPayload]);
  const overview = asset.overview || {};
  const breakdown = asset.areaBreakdown || {};
  const rows = asset.normalizedRows || [];
  const kpis = (asset.kpis || []).filter((item) => item.key !== 'unique_tenant_count').slice(0, 5);
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
              ['임대면적', formatArea(firstDefined(source.leasedAreaSqm, tenant.leasedAreaSqm))],
              ['월 임대료', formatCurrency(firstDefined(source.monthlyRentTotal, tenant.monthlyRentTotal))],
              ['월 관리비', formatCurrency(firstDefined(source.monthlyMfTotal, tenant.monthlyMfTotal))],
              ['월 임관리비', formatCurrency(firstDefined(source.monthlyCombinedTotal, source.monthlyCostTotal, tenant.monthlyCombinedTotal, tenant.monthlyCostTotal))],
              ['평당 임대료', formatCurrency(firstDefined(source.currentRentPerPy, tenant.rentPerPy))],
              ['평당 관리비', formatCurrency(firstDefined(source.currentMfPerPy, tenant.mfPerPy))],
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
                formatPy(row.leasedAreaSqm),
                formatCurrency(row.monthlyRentTotal),
                formatCurrency(row.monthlyMfTotal),
                formatCurrency(row.monthlyCombinedTotal),
                formatCurrency(row.currentRentPerPy),
                formatCurrency(row.currentMfPerPy),
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
              ['평균 E.NOC', formatCurrency(firstDefined(overview.averageENoc, kpis.find((item) => item.key === 'average_e_noc')?.value))],
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
              formatCurrency(row.storedENoc),
              formatCurrency(row.recomputedENoc),
              formatNumber(row.variance),
              formatCurrency(row.rentPerPy),
              formatCurrency(row.mfPerPy),
            ])}
            compact
          />
        </div>
      ),
    });
  };
  const areaRows = [
    ['전체 연면적', formatArea(firstDefined(breakdown.grossFloorAreaSqm, overview.grossFloorAreaSqm)), '100%'],
    ['임대면적', formatArea(firstDefined(breakdown.leasedAreaSqm, overview.leasedAreaSqm)), formatPercent(Number(firstDefined(breakdown.leasedAreaSqm, overview.leasedAreaSqm) || 0) / Number(firstDefined(breakdown.grossFloorAreaSqm, overview.grossFloorAreaSqm) || 1))],
    ['공실면적', formatArea(firstDefined(breakdown.vacancyAreaSqm, overview.vacancyAreaSqm)), formatPercent(firstDefined(breakdown.vacancyRate, overview.vacancyRate))],
    ['전용면적', formatArea(breakdown.exclusiveAreaSqm), formatPercent(breakdown.exclusiveRatio)],
    ['창고', formatArea(breakdown.warehouseAreaSqm), '-'],
    ['하역장', formatArea(breakdown.dockAreaSqm), '-'],
    ['사무실', formatArea(breakdown.officeAreaSqm), '-'],
    ['기타 전용', formatArea(breakdown.otherExclusiveAreaSqm), '-'],
    ['공용면적 subtotal', formatArea(Number(breakdown.coreAreaSqm || 0) + Number(breakdown.corridorAreaSqm || 0) + Number(breakdown.mechanicalAreaSqm || 0) + Number(breakdown.otherCommonAreaSqm || 0) + Number(breakdown.rampAreaSqm || 0) + Number(breakdown.parkingAreaSqm || 0)), '-'],
    ['기계전기실', formatArea(breakdown.mechanicalAreaSqm), '-'],
    ['층별 코어', formatArea(breakdown.coreAreaSqm), '-'],
    ['기타 공용', formatArea(breakdown.otherCommonAreaSqm), '-'],
    ['통로', formatArea(breakdown.corridorAreaSqm), '-'],
    ['램프', formatArea(breakdown.rampAreaSqm), '-'],
    ['주차장', formatArea(breakdown.parkingAreaSqm), '-'],
  ];
  const rosterHeaders = ['임차인명', '층/세부구역', '임대면적(㎡)', '임대면적(평)', '월 임대료', '월 관리비', '월 임관리비', '평당 임대료', '평당 관리비', '현재 계약개시일', '현재 계약만기일'];
  const rosterRows = rows.map((row) => [
    row.tenantMasterName,
    row.spaceLabel,
    formatArea(row.leasedAreaSqm),
    formatPy(row.leasedAreaSqm),
    formatCurrency(row.monthlyRentTotal),
    formatCurrency(row.monthlyMfTotal),
    formatCurrency(row.monthlyCombinedTotal),
    formatCurrency(row.currentRentPerPy),
    formatCurrency(row.currentMfPerPy),
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
  const monthlyCostHeaders = ['임차인명', 'Lease Space 수', '임대면적', '월 임대료', '월 관리비', '월 임관리비'];
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
            <h3 className="text-[26px] text-white font-semibold mt-1">{overview.assetName || '자산'}</h3>
            <p className="text-[13px] text-[#A1A1AA] mt-2">{overview.standardizedAddress || '주소 미입력'} · 사용승인 {formatDate(overview.approvalDate)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select value={selectedAssetId} onChange={(event) => setSelectedAssetId(event.target.value)} className="h-10 min-w-[280px] rounded-[8px] border border-[#3A3A3C] bg-[#1F1F1E] px-3 text-[13px] text-white">
              {assetOptionsData.map((item) => <option key={item.assetId} value={item.assetId}>{item.assetName}</option>)}
            </select>
            <button type="button" onClick={() => (mapPoint.length ? setModal({ title: '포트폴리오 위치', content: <div className="space-y-4"><PortfolioMapPlot points={mapPoint} /><DataTable headers={['자산명', '주소', '좌표']} rows={[[overview.assetName, overview.standardizedAddress || '-', `${overview.latitude}, ${overview.longitude}`]]} compact /></div> }) : openTableModal('자산 위치 정보', ['항목', '내용'], [['자산명', overview.assetName || '-'], ['주소', overview.standardizedAddress || '-'], ['좌표', '미입력']]))} className="h-10 px-3 rounded-[8px] bg-white text-[#1F1F1E] text-[13px] font-semibold hover:bg-[#E5E5E5]">자산 위치 보기</button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-5 gap-3">
        {kpis.map((item) => (
          <button key={item.key || item.label} type="button" onClick={() => {
            if (item.key === 'average_e_noc') {
              openENocAudit();
              return;
            }
            openTableModal(item.label, ['항목', '내용'], [['값', formatMetric(item.value, item.valueType)], ['자산', overview.assetName || '-'], ['상태', item.status || '-']]);
          }} className="text-left rounded-[14px] border border-[#333333] bg-[#252524] px-4 py-4 hover:bg-[#2A2A29]">
            <div className="text-[12px] text-[#86868B] font-semibold">{item.label}</div>
            <div className="text-[22px] text-white font-semibold mt-2">{formatMetric(item.value, item.valueType)}</div>
          </button>
        ))}
      </section>

      <section className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
        <SectionHeader eyebrow="TENANTS" title="임차인 현황" right={<button type="button" onClick={() => openTableModal('임차인 현황', rosterHeaders, rosterRows)} className="h-9 px-3 rounded-[8px] bg-[#30302F] text-white text-[13px] font-semibold hover:bg-[#3A3A3A]">원본 표 보기</button>} />
        <DataTable headers={rosterHeaders} rows={rosterRows} onRowClick={(index) => openTenantDetail(rows[index], '임차인 상세')} compact />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
          <SectionHeader eyebrow="SUMMARY" title="자산 핵심 요약" />
          <div className="grid grid-cols-2 gap-3">
            {[
              ['현재 임차인 수', `${formatNumber(firstDefined(overview.uniqueTenantCount, rows.length))}개`],
              ['Lease Space 수', `${formatNumber(firstDefined(overview.leaseSpaceCount, rows.length))}개`],
              ['총 임대면적', formatArea(overview.leasedAreaSqm)],
              ['월 임관리비', formatCurrency(overview.monthlyCostTotal)],
              ['평균 E.NOC', formatCurrency(overview.averageENoc)],
              ['건축물대장 상태', overview.reviewStatus || overview.buildingHubStatus || '-'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-[14px] border border-[#333333] bg-[#1F1F1E] px-4 py-4">
                <div className="text-[12px] text-[#86868B] font-semibold">{label}</div>
                <div className="text-[20px] text-white font-semibold mt-2">{value}</div>
              </div>
            ))}
          </div>
        </div>
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
          <DataTable headers={['항목', '면적', '비율']} rows={areaRows} compact />
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
          <SectionHeader eyebrow="EXPIRY" title="만기 스냅샷" right={<button type="button" onClick={() => openTableModal('만기 스냅샷', ['임차인명', '세부 구역', '계약만기일', '잔여 개월', '월 임관리비'], expiryRows)} className="h-9 px-3 rounded-[8px] bg-[#30302F] text-white text-[13px] font-semibold hover:bg-[#3A3A3A]">원본 표 보기</button>} />
          <RichBarChart rows={asset.expiryRows} labelKey="tenantMasterName" valueKey="monthsToExpiry" valueType="number" valueLabel="계약만기까지 잔여 개월" onClick={() => openTableModal('만기 스냅샷', ['임차인명', '세부 구역', '계약만기일', '잔여 개월', '월 임관리비'], expiryRows)} />
        </div>
        <div className="rounded-[20px] border border-[#333333] bg-[#252524] p-5">
          <SectionHeader eyebrow="CORE TENANTS" title="핵심 임차인" />
          <div className="space-y-2">
            {(asset.analytics?.coreTenants || asset.uniqueTenants || []).slice(0, 5).map((tenant) => (
              <button key={tenant.tenantId || tenant.tenantMasterName} type="button" onClick={() => openTenantDetail(tenant, '임차인 상세')} className="w-full text-left rounded-[12px] border border-[#333333] bg-[#1F1F1E] p-4 hover:bg-[#2A2A29]">
                <div className="text-[14px] text-white font-semibold">{tenant.tenantMasterName}</div>
                <div className="text-[12px] text-[#86868B] mt-1">월 임관리비 {formatCurrency(firstDefined(tenant.monthlyCostTotal, tenant.monthlyCombinedTotal))} · 임대면적 {formatArea(tenant.leasedAreaSqm)} · 최근 만기 {formatDate(firstDefined(tenant.latestExpiry, tenant.earliestExpiry))}</div>
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function DashboardShell({ activeModule }) {
  const selected = MODULES.find((item) => item.id === activeModule) || MODULES[0];

  return (
    <div className="w-full max-w-[1480px] mx-auto px-8 pt-8 pb-14">
      <SectionHeader
        eyebrow="INTERNAL MODULE"
        title="임대차 Dashboard"
        right={<StatusPill className="bg-[#222] text-[#A1A1AA] border-[#3A3A3C]">원본 기준</StatusPill>}
      />

      <div className="flex flex-wrap gap-2 mb-6">
        {MODULES.map((module) => {
          const active = module.id === selected.id;
          return (
            <button
              key={module.id}
              type="button"
              onClick={() => navigateTo(pathFor(`dashboard/${module.id}`))}
              className={`h-9 px-3 rounded-[8px] border text-[13px] font-semibold transition-colors ${active ? 'bg-white text-[#1F1F1E] border-white' : 'bg-[#252524] text-[#C7C7CC] border-[#3A3A3C] hover:bg-[#30302F]'}`}
            >
              {module.label}
            </button>
          );
        })}
      </div>

      <DashboardStoryRail activeId={selected.id} />

      {selected.id === 'weekly' ? <WeeklyDashboard /> : selected.id === 'home' ? <HomeDashboard /> : selected.id === 'asset' ? <AssetDashboard /> : selected.id === 'company' ? <CompanyDashboard /> : selected.id === 'sector' ? <SectorDashboard /> : (
      <section className="border border-[#333333] rounded-[20px] bg-[#252524] overflow-hidden">
        <div className="px-6 py-5 border-b border-[#333333] flex items-center justify-between gap-4">
          <div>
            <div className="text-[12px] text-[#86868B] font-semibold">SOURCE TAB</div>
            <h3 className="text-[24px] text-white font-semibold tracking-tight mt-1">{selected.source}</h3>
          </div>
          <StatusPill className="bg-[#1F1F1E] text-[#FFD166] border-[#4C4329]">검증 대기</StatusPill>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="p-6 border-b lg:border-b-0 lg:border-r border-[#333333]">
            <div className="text-[14px] text-[#C7C7CC] leading-7">
              기준 탭의 숫자, 표, 차트, 지도, 상세 화면을 순서대로 배치합니다.
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
              {['KPI', 'Table', 'Chart/Map', 'Popup'].map((item) => (
                <div key={item} className="rounded-[12px] bg-[#1F1F1E] border border-[#333333] px-4 py-4">
                  <div className="text-[12px] text-[#86868B] font-semibold">{item}</div>
                  <div className="text-[18px] text-white font-semibold mt-2">대기</div>
                </div>
              ))}
            </div>
          </div>
          <div className="p-6">
            <div className="text-[13px] text-[#86868B] font-semibold mb-3">PARITY ORDER</div>
            <ol className="space-y-3">
              {MODULES.map((module, index) => (
                <li key={module.id} className="flex items-center justify-between gap-4 text-[13px]">
                  <span className="text-[#E5E5E5]">{index + 1}. {module.source}</span>
                  <span className="text-[#86868B]">{module.id === selected.id ? '선택' : '대기'}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>
      )}
    </div>
  );
}

function LegacyWorkspaceLogistics({ currentPath = '' }) {
  const { memberInfo } = useAuth();
  const [query, setQuery] = useState('');
  const [scopeFilter, setScopeFilter] = useState('전체');
  const [dataCounts, setDataCounts] = useState(null);

  const isDashboard = currentPath.startsWith(pathFor('dashboard'));
  const activeModule = currentPath.split('/').pop() || 'weekly';

  useEffect(() => {
    let mounted = true;
    async function fetchCounts() {
      try {
        const tables = ['ll_assets', 'll_tenants', 'll_leases', 'll_issues'];
        const results = await Promise.all(
          tables.map((table) => supabase.from(table).select('*', { count: 'exact', head: true }))
        );
        if (!mounted) return;
        setDataCounts({
          assets: results[0].count,
          tenants: results[1].count,
          leases: results[2].count,
          issues: results[3].count,
        });
      } catch {
        if (mounted) setDataCounts(null);
      }
    }
    fetchCounts();
    return () => { mounted = false; };
  }, []);

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
    return <DashboardShell activeModule={MODULES.some((item) => item.id === activeModule) ? activeModule : 'weekly'} />;
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
            <h1 className="text-[34px] font-semibold tracking-tight text-white mt-2">물류센터 섹터 워크 플랫폼</h1>
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
