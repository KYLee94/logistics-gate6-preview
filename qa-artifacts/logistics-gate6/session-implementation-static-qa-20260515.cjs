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
const analysisTools = between('function AnalysisToolsDashboard', 'function DataPlaygroundDashboard');
const homeDashboard = between('function HomeDashboard', 'function SimpleBarChart');
const workspaceMain = between('export default function WorkspaceLogistics', 'function HomeDashboard');
const dataQuality = between('function DataQualityDashboard', 'function AssetDashboard');
const tableHelpers = between('function getTableColumnMeta', 'function LogisticsModal');
const chartHelpers = between('function chartMetricLabel', 'function TrendChart');
const doughnutChart = between('function DoughnutBreakdownChart', 'function MiniLineChart');
const weeklyDashboard = between('function WeeklyDashboard', 'void LegacyWorkspaceLogistics');
const weeklyUploadPanel = between('function WeeklyWordUploadPanel', 'function MainWorklogRow');

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
      && !tenantFullView.includes("'사업자번호'"),
  },
  {
    id: 'tenant_contract_full_modal_is_large_and_sticky',
    pass: source.includes("size: 'fullscreen', content: <TenantContractFullView")
      && tenantFullView.includes('max-h-[70vh]')
      && tenantFullView.includes('min-w-[2500px]')
      && tenantFullView.includes('sticky left-[180px]'),
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
    id: 'analysis_tools_filters_company_options_by_readable_assets',
    pass: analysisTools.includes('const readableCompanyOptions = useMemo')
      && analysisTools.includes('sourceRows.forEach')
      && analysisTools.includes('{readableCompanyOptions.map((item) => (')
      && !analysisTools.includes('{companyOptionsData.map((item) => ('),
  },
  {
    id: 'analysis_tools_has_benchmark_average_rank_and_drilldown',
    pass: analysisTools.includes('portfolioAverage')
      && analysisTools.includes('selectedAverage')
      && analysisTools.includes('metricRankByAssetId')
      && analysisTools.includes('전체 평균 대비')
      && analysisTools.includes('순위')
      && analysisTools.includes('onRowClick={(index) => openAnalysisAssetDetail(rows[index])}'),
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
      && workspaceMain.includes('title="원본 데이터 수정"')
      && workspaceMain.includes('Excel 다운로드')
      && workspaceMain.includes('수정 Excel 업로드')
      && !dataQuality.includes('Excel 한 시트 수정 파일'),
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
  {
    id: 'data_quality_uses_edge_findings_queue_readback_approval',
    pass: source.includes("action: 'quality/findings'")
      && dataQuality.includes("action: 'edits/list'")
      && dataQuality.includes("action: 'edits/readback'")
      && dataQuality.includes("action: 'edits/approve'")
      && dataQuality.includes("action: 'edits/reject'")
      && dataQuality.includes('수정 요청 승인 대기')
      && !source.includes('/rest/v1/ll_data_quality_findings'),
  },
  {
    id: 'chart_tooltips_follow_cursor_right_and_clamp_to_viewport',
    pass: chartHelpers.includes('tooltipWidth = 270')
      && chartHelpers.includes('window.innerWidth')
      && chartHelpers.includes('Math.min(Math.max(12, rawX), maxX)')
      && !chartHelpers.includes('left: hoveredPoint.x + 16')
      && !source.includes('left: hoveredBar.x + 16')
      && !source.includes('left: hoveredSegment.x + 16'),
  },
  {
    id: 'doughnut_hover_uses_segment_event_single_value',
    pass: doughnutChart.includes('const svgRef = useRef(null)')
      && doughnutChart.includes('const segmentFromPointer = (event) =>')
      && doughnutChart.includes('const segmentFromEventTarget = (event) =>')
      && doughnutChart.includes('const showSegmentTooltip = (event, explicitSegment) =>')
      && doughnutChart.includes('const segment = explicitSegment || segmentFromPointer(event) || segmentFromEventTarget(event)')
      && doughnutChart.includes('onMouseMove={(event) => showSegmentTooltip(event)}')
      && doughnutChart.includes('onClick={(event) => handleSegmentClick(event)}')
      && doughnutChart.includes('className="h-full w-full cursor-pointer"')
      && doughnutChart.includes("style: { pointerEvents: 'none' }")
      && doughnutChart.includes('data-segment-label')
      && doughnutChart.includes('const sourceRows = (rows || []).filter((row) => Number(row.value || 0) > 0).slice(0, 8);')
      && doughnutChart.includes('const legendRows = chartRows;')
      && !source.includes('function pickDoughnutSegmentFromPointer')
      && !doughnutChart.includes('const segment = pickDoughnutSegmentFromPointer'),
  },
  {
    id: 'home_monthly_cost_composition_percent_uses_visible_source_total',
    pass: homeDashboard.includes('const monthlyCostCompositionTotal = sumRows(monthlyCostSourceRows, (row) => row.value) || canonicalMonthlyCost;'),
  },
  {
    id: 'chart_axes_use_nice_tick_specs_for_trend_and_bar',
    pass: source.includes('function buildAxisSpec')
      && chartHelpers.includes('const leftAxis = buildAxisSpec')
      && source.includes('const axis = buildAxisSpec(Math.max(...chartRows.map')
      && source.includes('function axisLabelText')
      && source.includes('const xLabelStep = Math.max(1, Math.ceil(points.length / 7))')
      && source.includes('rotate(-32'),
  },
  {
    id: 'tables_with_many_columns_have_fixed_min_widths',
    pass: tableHelpers.includes('if (metas.length >= 8) return metas')
      && tableHelpers.includes('const minTableWidth = headers.length >= 8')
      && tableHelpers.includes('spaceLike')
      && tableHelpers.includes('style={minTableWidth ? { minWidth: minTableWidth } : undefined}'),
  },
  {
    id: 'logistics_scroll_uses_main_reference_custom_scrollbar',
    pass: source.includes('custom-scrollbar overflow-x-auto rounded-[10px]')
      && source.includes('custom-scrollbar p-6 overflow-auto')
      && source.includes('custom-scrollbar max-h-[70vh] overflow-auto')
      && source.includes('custom-scrollbar overflow-auto rounded-[10px]'),
  },
  {
    id: 'area_format_does_not_force_small_positive_values_to_one_py',
    pass: source.includes("return `${formatDecimalNumber(numeric * 0.3025, 1)}평`;")
      && !source.includes('Math.max(1, Math.round(numeric * 0.3025))'),
  },
  {
    id: 'data_quality_excel_upload_has_file_safety_guards',
    pass: source.includes('function safeFileNameText')
      && source.includes('QUALITY_ALLOWED_ACTIONS')
      && workspaceMain.includes('xlsx 또는 xls 파일만 업로드할 수 있습니다.')
      && workspaceMain.includes('10MB 이하만 업로드할 수 있습니다.'),
  },
  {
    id: 'weekly_upload_popup_is_minimal_and_not_noisy',
    pass: weeklyUploadPanel.includes('주간업무보고자료 업로드')
      && weeklyUploadPanel.includes('반영 기간')
      && weeklyUploadPanel.includes('파일 선택')
      && weeklyUploadPanel.includes('데이터 반영')
      && !weeklyUploadPanel.includes('WEEKLY WORD INGEST')
      && !weeklyUploadPanel.includes('기준 파일:')
      && !weeklyUploadPanel.includes('uploadState.message &&'),
  },
  {
    id: 'weekly_upload_popup_shows_selected_monday_sunday_range',
    pass: weeklyUploadPanel.includes('selectedWeekRangeLabel')
      && weeklyUploadPanel.includes('aria-label="선택한 주차 날짜 범위"')
      && weeklyUploadPanel.includes("formData.append('week_range'"),
  },
  {
    id: 'main_task_slash_text_renders_as_bullet_list',
    pass: source.includes('function splitTaskBullets(value)')
      && source.includes('.split(/\\n|(?:\\s+\\/\\s+)|(?:\\s*\\/\\s*)/u)')
      && workspaceMain.includes('renderBulletListCell(task.nextAction || task.issue')
      && !workspaceMain.includes('splitTaskBullets(task.nextAction)[0]'),
  },
  {
    id: 'weekly_top_controls_are_six_equal_horizontal_blocks',
    pass: weeklyDashboard.includes('xl:grid-cols-6')
      && weeklyDashboard.includes('flex h-[100px] flex-col justify-between')
      && weeklyDashboard.includes('총 자산 수')
      && weeklyDashboard.includes('총 연면적')
      && weeklyDashboard.includes('보고일')
      && weeklyDashboard.includes('{week.week}주차 · {week.weekRange}'),
  },
  {
    id: 'main_search_is_inline_between_profile_and_asset_grid',
    pass: workspaceMain.includes('md:grid-cols-[112px_minmax(0,1fr)]')
      && workspaceMain.includes('자산·임차인·계약·이슈를 검색하거나 질문하세요')
      && workspaceMain.indexOf('통합 검색') > workspaceMain.indexOf('permission.name')
      && workspaceMain.indexOf('통합 검색') < workspaceMain.indexOf('topAssets.map')
      && !workspaceMain.includes('mx-auto max-w-[880px]'),
  },
  {
    id: 'main_original_data_edit_panel_is_bottom_roundtrip_panel',
    pass: workspaceMain.includes('title="원본 데이터 수정"')
      && workspaceMain.includes('mainQualityAssetId')
      && workspaceMain.includes('downloadMainQualityWorkbook')
      && workspaceMain.includes('importMainQualityWorkbook')
      && workspaceMain.includes('수정 Excel 업로드')
      && !dataQuality.includes('title="원본 데이터 수정"'),
  },
  {
    id: 'home_top_assets_show_core_tenant_instead_of_vacancy_rate',
    pass: homeDashboard.includes('const topTenantNameByAsset = useMemo')
      && homeDashboard.includes("['자산명', '월 임관리비', '임대면적(평)', '핵심 임차인']")
      && homeDashboard.includes('topTenantNameByAsset[row.assetName]')
      && !homeDashboard.includes("['자산명', '월 임관리비', '임대면적(평)', '공실률']"),
  },
  {
    id: 'tenant_contract_summary_removes_business_number_and_widens_asset_list',
    pass: homeDashboard.includes("headers={['임차인명', '자산 수', '구역 수', '자산 목록', '임대면적(평)', '월 임대료', '월 관리비', '월 임관리비', '최근 만기일']}")
      && homeDashboard.includes('whitespace-pre-line break-keep')
      && !homeDashboard.includes("'사업자번호']}"),
  },
  {
    id: 'rich_trend_chart_axis_layout_has_extra_top_bottom_space',
    pass: chartHelpers.includes('const height = 410')
      && chartHelpers.includes('const paddingLeft = 124')
      && chartHelpers.includes('const paddingTop = 62')
      && chartHelpers.includes('const paddingBottom = 100')
      && chartHelpers.includes('fontSize="15" fontWeight="800"'),
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
