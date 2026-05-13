import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../utils/supabaseClient';
import { useAuth } from '../../../context/AuthContext';
import weeklyReportData from './logisticsWeeklyReportData.json';
import homeData from './logisticsHomeData.json';

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
  const numeric = Number(value || 0);
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
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return '-';
  return `${(numeric * 100).toFixed(1)}%`;
}

function formatArea(value) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return '-';
  return `${formatNumber(Math.round(numeric))}㎡`;
}

function formatCurrency(value) {
  const numeric = Number(value || 0);
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
    <div className="flex items-end justify-between gap-4 mb-4">
      <div>
        <div className="text-[12px] font-semibold text-[#86868B] tracking-[0.02em]">{eyebrow}</div>
        <h2 className="text-[22px] font-semibold text-white tracking-tight mt-1">{title}</h2>
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
    <div className="overflow-auto rounded-[14px] border border-[#333333]">
      <table className="w-full min-w-[760px] text-left border-collapse">
        <thead className="bg-[#1F1F1E] text-[#86868B] text-[12px]">
          <tr>
            {headers.map((header) => (
              <th key={header} className="py-3 px-3 first:pl-4 last:pr-4 font-semibold whitespace-nowrap">{header}</th>
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
                <td key={`${cellIndex}-${cell}`} className={`${compact ? 'py-2' : 'py-3'} px-3 first:pl-4 last:pr-4 text-[13px] text-[#E5E5E5] align-top`}>
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
  const report = weeklyReportData;
  const assetRows = useMemo(() => normalizeWeeklyAssetRows(report.assetRows || []), [report.assetRows]);
  const [assetView, setAssetView] = useState('core');
  const [selectedNewId, setSelectedNewId] = useState(report.newProjects?.[0]?.id || '');
  const [selectedManagementId, setSelectedManagementId] = useState(report.managementProjects?.[0]?.id || '');
  const [modal, setModal] = useState(null);

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

function TrendChart({ rows, valueKey, secondaryKey, valueType = 'currency' }) {
  const points = (rows || []).filter((row) => row?.[valueKey] != null).slice(-18);
  if (!points.length) return <div className="text-[13px] text-[#86868B]">표시할 차트 데이터가 없습니다.</div>;
  const width = 760;
  const height = 220;
  const padding = 28;
  const maxValue = Math.max(...points.map((row) => Number(row[valueKey] || 0)), 1);
  const secondaryMax = Math.max(...points.map((row) => Number(row[secondaryKey] || 0)), 1);
  const coords = points.map((row, index) => {
    const x = padding + (index * (width - padding * 2)) / Math.max(points.length - 1, 1);
    const y = height - padding - (Number(row[valueKey] || 0) / maxValue) * (height - padding * 2);
    const y2 = height - padding - (Number(row[secondaryKey] || 0) / secondaryMax) * (height - padding * 2);
    return { x, y, y2, row };
  });
  return (
    <div className="rounded-[14px] border border-[#333333] bg-[#1F1F1E] p-4">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[220px]" role="img" aria-label="Home trend chart">
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#3A3A3C" />
        <polyline points={coords.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke="#9AD7FF" strokeWidth="3" />
        <polyline points={coords.map((point) => `${point.x},${point.y2}`).join(' ')} fill="none" stroke="#B5E48C" strokeWidth="2" strokeDasharray="5 5" />
        {coords.map((point) => (
          <circle key={`${point.row.month}-${point.x}`} cx={point.x} cy={point.y} r="3.5" fill="#9AD7FF" />
        ))}
      </svg>
      <div className="flex items-center justify-between text-[12px] text-[#86868B] mt-2">
        <span>{points[0]?.month || points[0]?.label}</span>
        <span>{valueType === 'currency' ? '금액 추이' : '면적 추이'} / 자산·임차인 수</span>
        <span>{points[points.length - 1]?.month || points[points.length - 1]?.label}</span>
      </div>
    </div>
  );
}

function PortfolioMapPlot({ points }) {
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
        <TrendChart rows={rentTrendRows} valueKey="monthlyCostTotalAdjusted" secondaryKey="activeAssetCount" />
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
          <TrendChart rows={data.monthlyExpiryRows} valueKey="expiringAreaSqm" secondaryKey="uniqueTenantCount" valueType="area" />
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

      {selected.id === 'weekly' ? <WeeklyDashboard /> : selected.id === 'home' ? <HomeDashboard /> : (
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

export default function WorkspaceLogistics({ currentPath = '' }) {
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
