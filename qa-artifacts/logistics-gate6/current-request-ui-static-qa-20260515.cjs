const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const sourcePath = path.join(repoRoot, 'src/components/system/workspace/WorkspaceLogistics.jsx');
const source = fs.readFileSync(sourcePath, 'utf8');

const indexOf = (text) => source.indexOf(text);
const pivotResultIndex = indexOf('title="피벗 결과 테이블"');
const pivotChartIndex = indexOf('title="피벗 결과 차트"');

const checks = [
  {
    id: 'main_profile_uses_photo_avatar_with_initial_fallback',
    pass: source.includes('function MemberAvatar') && source.includes('memberAvatarSource') && source.includes('<MemberAvatar memberInfo={memberInfo} name={permission.name} />'),
  },
  {
    id: 'main_search_title_spacing_adjusted',
    pass: source.includes('mx-auto grid w-full max-w-[980px]') && source.includes('md:grid-cols-[128px_minmax(0,1fr)]') && source.includes('자산·임차인·계약·이슈를 검색하거나 질문하세요'),
  },
  {
    id: 'managed_asset_cards_left_align_and_word_wrap',
    pass: source.includes('items-center justify-start') && source.includes('whitespace-normal break-keep text-left') && source.includes('[overflow-wrap:anywhere]') && !source.includes('max-w-full truncate break-keep font-bold text-white'),
  },
  {
    id: 'playground_has_per_py_metrics',
    pass: source.includes("{ key: 'currentRentPerPy', label: '평당 월임대료'") && source.includes("{ key: 'currentMfPerPy', label: '평당 월관리비'"),
  },
  {
    id: 'playground_pivot_table_above_chart',
    pass: pivotResultIndex > -1 && pivotChartIndex > -1 && pivotResultIndex < pivotChartIndex,
  },
  {
    id: 'analysis_filters_blank_dash_company_option',
    pass: source.includes("tenantMasterName === '-'") && source.includes('ANALYSIS_METRIC_KEYS') && source.includes("'currentRentPerPy'") && source.includes("'currentMfPerPy'"),
  },
  {
    id: 'analysis_metric_selector_moved_to_visible_control_row',
    pass: source.includes('비교 지표</span>') && source.includes('선택 자산 벤치마크와 계약 원장을 같은 지표 기준으로 다시 계산합니다.'),
  },
  {
    id: 'company_exposure_chart_value_shows_share_ratio',
    pass: source.includes('const exposureTotal = exposureRows.reduce') && source.includes('displayValue: `${formatMetric(row.value') && source.includes('rows={exposureChartRows}'),
  },
  {
    id: 'original_data_edit_removed_from_main_bottom',
    pass: !source.includes('Supabase 관계키 포함') && !source.includes('mainQualityAssetId') && !source.includes('mainExcelStatus') && !source.includes('mainExcelUploadRef'),
  },
  {
    id: 'original_data_edit_available_from_dashboard_top_modal',
    pass: source.includes('function OriginalDataEditPanel') && source.includes("title: '원본 데이터 수정'") && source.includes('<OriginalDataEditPanel permission={permission} />') && source.includes('canUseOriginalDataEdit') && source.includes('${DARK_BUTTON_CLASS}'),
  },
  {
    id: 'quality_excel_uses_user_readable_source_sheet_columns',
    pass: source.includes("'DB_일반'") && source.includes("'DB_히스토리 누적'") && source.includes("'원본시트'") && source.includes("'원본항목명'") && source.includes("'계약/행 식별'"),
  },
  {
    id: 'quality_excel_upload_goes_to_approval_alert_queue',
    pass: source.includes("source: 'quality_excel_roundtrip'") && source.includes('원본 데이터 수정 업로드 알림') && source.includes('관리자 확인 후 최종 반영') && source.includes('acceptedRows'),
  },
  {
    id: 'quality_excel_permission_scope_is_fail_closed',
    pass: source.includes('if (!readableAssets.length) return false') && source.includes('canUseOriginalDataEdit = canViewDataQuality(memberInfo, permission)'),
  },
  {
    id: 'quality_excel_roundtrip_requires_source_trace_and_modify_only',
    pass: source.includes("const QUALITY_ALLOWED_ACTIONS = new Set(['수정'])")
      && source.includes("'source_row_id'")
      && source.includes("'source_cell_id'")
      && source.includes('현재 Excel 왕복 수정 파일은 수정 행위만 지원합니다'),
  },
  {
    id: 'quality_excel_target_row_key_is_table_aware',
    pass: source.includes('function qualityTargetRowId') && source.includes("field.table === 'public.ll_assets'") && source.includes("field.table === 'public.ll_tenants'") && source.includes("field.table === 'public.ll_rent_history'") && source.includes("field.table === 'public.ll_leasing_contracts'"),
  },
  {
    id: 'logistics_task_ui_matches_latest_reference_structure',
    pass: source.includes('지난 Task 관리') && source.includes('workspace=logistics') && source.includes('!taskEditTarget && taskDraft') && source.includes("taskEditTarget?.id === task.id") && source.includes('다음액션') && source.includes('상세 내용 입력'),
  },
  {
    id: 'home_use_category_keeps_composite_label',
    pass: source.includes("const USE_CATEGORY_LABELS = ['상온창고', '복합', '저온창고', '사무실']") && source.includes('inferUseCategoryFromLeaseRow') && source.includes("label === '복합'"),
  },
  {
    id: 'tenant_contract_per_py_columns_and_wide_detail',
    pass: source.includes("'평당 월 임대료'") && source.includes("'평당 월 관리비'") && source.includes("'평당 월 임관리비'") && source.includes('calculatePerPy(group.monthlyCostTotal, group.leasedAreaSqm)') && source.includes("size: 'fullscreen'"),
  },
  {
    id: 'home_rent_trend_hover_and_table_show_newly_added_assets',
    pass: source.includes('function formatNewlyAddedAssets')
      && source.includes("label: '신규 편입 자산'")
      && source.includes('extraTooltipRows={(row) => [{')
      && source.includes("['월', '월 임대료(RF/FO 반영)'")
      && source.includes('formatNewlyAddedAssets(row)'),
  },
];

const result = {
  generatedAt: new Date().toISOString(),
  sourcePath,
  allPass: checks.every((check) => check.pass),
  checks,
};

const outDir = path.join(__dirname, 'current-request-ui-static-qa-20260515');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'result.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');

console.log(JSON.stringify(result, null, 2));
if (!result.allPass) process.exit(1);
