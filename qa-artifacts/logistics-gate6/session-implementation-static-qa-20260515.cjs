const fs = require('fs');
const path = require('path');

const repo = process.cwd();
const sourcePath = path.join(repo, 'src', 'components', 'system', 'workspace', 'WorkspaceLogistics.jsx');
const source = fs.readFileSync(sourcePath, 'utf8');

function between(start, end) {
  const startIndex = source.indexOf(start);
  if (startIndex < 0) return '';
  const endIndex = source.indexOf(end, startIndex + start.length);
  return source.slice(startIndex, endIndex < 0 ? source.length : endIndex);
}

const tenantFullView = between('function TenantContractFullView', 'function ProjectDetail');
const companyDartRows = between('function companyDartRows', 'function deriveLogisticsRegionFromAddress');
const companyDashboard = between('function CompanyDashboard', 'function WeeklyDashboard');
const dataPlayground = between('function DataPlaygroundDashboard', 'function buildDataQualityFindings');
const homeDashboard = between('function HomeDashboard', 'function SimpleBarChart');
const workspaceMain = between('export default function WorkspaceLogistics', 'function HomeDashboard');
const dataQuality = between('function DataQualityDashboard', 'function AssetDashboard');

const checks = [
  {
    id: 'home_monthly_cost_uses_asset_snapshot_basis',
    pass: /const assetSnapshotMonthlyCost = sumRows\(readableAssetOptions/.test(homeDashboard)
      && /const canonicalMonthlyCost = Number\(assetSnapshotMonthlyCost \|\| data\.monthlyCost \|\| leaseSpaceMonthlyCost/.test(homeDashboard),
  },
  {
    id: 'home_kpi_cards_show_202604_basis',
    pass: source.includes("const DASHBOARD_BASIS_LABEL = '2026년 4월 기준'")
      && /kpiCards\.map\(\(\[label, value, basis, action\]\)/.test(homeDashboard),
  },
  {
    id: 'tenant_contract_full_modal_removes_review_and_source_columns',
    pass: !tenantFullView.includes("'검토상태'")
      && !tenantFullView.includes("'source row'")
      && !tenantFullView.includes("'source cell'")
      && tenantFullView.includes("'주소/권역'")
      && tenantFullView.includes("'사업자번호'"),
  },
  {
    id: 'tenant_contract_full_modal_is_large_and_sticky',
    pass: source.includes("size: 'fullscreen', content: <TenantContractFullView")
      && tenantFullView.includes('max-h-[70vh]')
      && tenantFullView.includes('min-w-[2680px]')
      && tenantFullView.includes('sticky left-[210px]'),
  },
  {
    id: 'company_dart_rows_remove_user_hidden_fields',
    pass: ['DART corp code', '매칭 상태', '업종', '재무 구분', '사용한 보고서', '접수번호', 'DART 적재일', '검토 메모']
      .every((label) => !companyDartRows.includes(label)),
  },
  {
    id: 'company_map_dart_ratio_and_exposure_full_width',
    pass: companyDashboard.includes('xl:grid-cols-[3.5fr_6.5fr]')
      && companyDashboard.includes('title="자산별 노출도"')
      && /<\/section>\s*<section className="rounded-\[20px\] border border-\[#333333\] bg-\[#252524\] p-5">\s*<SectionHeader\s+eyebrow="EXPOSURE"/s.test(companyDashboard),
  },
  {
    id: 'data_playground_has_pivot_table_controls',
    pass: source.includes('const PLAYGROUND_AGGREGATIONS')
      && source.includes('function buildPivotRows')
      && dataPlayground.includes('title="피벗테이블"')
      && dataPlayground.includes('행 필드')
      && dataPlayground.includes('열 필드')
      && dataPlayground.includes('값 필드')
      && dataPlayground.includes('집계 방식'),
  },
  {
    id: 'data_playground_supports_pivot_totals_and_drilldown',
    pass: dataPlayground.includes('피벗 결과 테이블')
      && dataPlayground.includes('총계')
      && dataPlayground.includes('원본 drilldown')
      && dataPlayground.includes('sticky left-0'),
  },
  {
    id: 'currency_chart_short_values_keep_one_decimal_billion',
    pass: /return `\$\{formatDecimalNumber\(numeric \/ 100000000, 1\)\}억`;/.test(source),
  },
  {
    id: 'workspace_main_removes_work_signal_cards_without_dashboard_status_cards',
    pass: !workspaceMain.includes('오늘 봐야 할 업무 신호')
      && !workspaceMain.includes('workspaceSignals')
      && !workspaceMain.includes('Dashboard 데이터 검증')
      && !workspaceMain.includes('raw data 상태'),
  },
  {
    id: 'tenant_contract_full_modal_supports_asset_and_tenant_filters',
    pass: tenantFullView.includes("value={assetFilter}")
      && tenantFullView.includes("value={tenantFilter}")
      && tenantFullView.includes('setAssetFilter')
      && tenantFullView.includes('setTenantFilter'),
  },
  {
    id: 'data_quality_excel_roundtrip_download_upload',
    pass: source.includes("import * as XLSX from 'xlsx'")
      && source.includes('QUALITY_EXCEL_COLUMNS')
      && source.includes('writeQualityWorkbook')
      && source.includes('readQualityWorkbook')
      && dataQuality.includes('Excel 한 시트 수정 파일')
      && dataQuality.includes('Excel 다운로드')
      && dataQuality.includes('수정 Excel 업로드'),
  },
  {
    id: 'data_quality_excel_keeps_supabase_relation_keys',
    pass: source.includes('target_table')
      && source.includes('target_row_id')
      && source.includes('primary_key_field')
      && source.includes('source_row_id')
      && source.includes('source_cell_id')
      && source.includes('before_value'),
  },
];

const result = {
  generated_at: new Date().toISOString(),
  source: sourcePath,
  allPass: checks.every((check) => check.pass),
  checks,
};

const outDir = path.join(repo, 'qa-artifacts', 'logistics-gate6', 'session-implementation-static-qa-20260515');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'result.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');

console.log(JSON.stringify(result, null, 2));
if (!result.allPass) process.exit(1);
