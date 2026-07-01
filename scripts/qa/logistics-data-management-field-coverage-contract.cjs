const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const artifactDir = path.join(repoRoot, 'qa-artifacts', 'logistics-gate6');
fs.mkdirSync(artifactDir, { recursive: true });

const frontend = fs.readFileSync(path.join(repoRoot, 'src/components/system/workspace/LogisticsSectorModules.jsx'), 'utf8');
const api = fs.readFileSync(path.join(repoRoot, 'supabase/functions/ll-dashboard-api/index.ts'), 'utf8');

function sliceBetween(text, startNeedle, endNeedle) {
  const start = text.indexOf(startNeedle);
  if (start < 0) return '';
  const end = text.indexOf(endNeedle, start + startNeedle.length);
  return end < 0 ? text.slice(start) : text.slice(start, end);
}

const workspaceBlock = sliceBetween(api, 'const DATA_MANAGEMENT_WORKSPACES', '];');
const visibleViewSetBlock = sliceBetween(api, 'const DATA_MANAGEMENT_VISIBLE_VIEW_KEYS', ']);');
const managerFieldBlock = sliceBetween(api, 'const DATA_MANAGEMENT_MANAGER_LINK_VIEW_FIELDS', '];');
const tenantFieldBlock = sliceBetween(api, 'const DATA_MANAGEMENT_TENANT_MASTER_VIEW_FIELDS', '];');
const normalizedViewSetBlock = sliceBetween(api, 'const DATA_MANAGEMENT_NORMALIZED_LEASE_VIEW_KEYS', ');');
const leaseAllFrontendBlock = sliceBetween(frontend, "workflow: 'lease_all'", "workflow: 'contract_basic'");
const dataManagementRenderBlock = sliceBetween(frontend, 'export function DataManagementDashboard', 'export function HomeOperatingCostSummary');
const assetIntegratedFieldBlock = sliceBetween(api, 'const DATA_MANAGEMENT_ASSET_INTEGRATED_VIEW_FIELDS', '];');
const investmentIntegratedFieldBlock = sliceBetween(api, 'const DATA_MANAGEMENT_INVESTMENT_INTEGRATED_VIEW_FIELDS', '];');
const leaseGeneralFieldBlock = sliceBetween(api, 'const DATA_MANAGEMENT_LEASE_VIEW_FIELDS', '];');
const assetIntegratedRowsBlock = sliceBetween(api, 'async function dataManagementAssetIntegratedRows', 'async function dataManagementInvestmentIntegratedRows');
const investmentIntegratedRowsBlock = sliceBetween(api, 'async function dataManagementInvestmentIntegratedRows', 'async function dataManagementLeaseContractRows');
const leaseContractRowsBlock = sliceBetween(api, 'async function dataManagementLeaseContractRows', 'async function dataManagementLeaseRentHistoryRows');

const requiredChecks = [
  ['dm_tabs_asset', /asset:\s*\{\s*key:\s*'asset'/u.test(frontend)],
  ['dm_tabs_investment', /investment:\s*\{\s*key:\s*'investment'/u.test(frontend)],
  ['dm_tabs_lease', /lease:\s*\{\s*key:\s*'lease'/u.test(frontend)],
  ['dm_tabs_managers', /managers:\s*\{\s*key:\s*'managers'/u.test(frontend)],
  ['dm_tabs_quality', /quality:\s*\{\s*key:\s*'quality'/u.test(frontend)],
  ['dm_no_market_tab_config', !/market:\s*\{\s*key:\s*'market'/u.test(frontend)],
  ['lease_workflow_unified', /workflow:\s*'lease_all'/u.test(frontend) && /defaultWorkflow:\s*'lease_all'/u.test(frontend) && /allowedWorkflows:\s*\['lease_all'\]/u.test(frontend)],
  ['lease_ui_hides_sub_view_selectors', /const showWorkflowSelector = false;/u.test(dataManagementRenderBlock) && /const showViewSelector = false;/u.test(dataManagementRenderBlock)],
  ['lease_all_labels_include_core_fields', ['평당 월임대료', '평당 월관리비', 'E. NOC', '전용률', '현재 계약기간', '요구 스펙', '특약', '임차인 정보'].every((label) => leaseAllFrontendBlock.includes(label))],
  ['asset_integrated_default', /defaultWorkflow:\s*'asset'/u.test(frontend) && /defaultViewKey:\s*'asset_integrated'/u.test(frontend)],
  ['investment_integrated_default', /defaultWorkflow:\s*'fund'/u.test(frontend) && /defaultViewKey:\s*'investment_integrated'/u.test(frontend)],
  ['api_visible_no_market_workspace', /key:\s*'igis'/u.test(workspaceBlock) && !/key:\s*'market'/u.test(workspaceBlock) && !/key:\s*'operations'/u.test(workspaceBlock)],
  ['api_visible_view_filter', /DATA_MANAGEMENT_VISIBLE_VIEW_KEYS/u.test(api)],
  ['api_visible_views_are_integrated_not_fragmented', ['asset_integrated', 'investment_integrated', 'lease_general_excel', 'lease_asset_manager_links', 'data_quality_findings'].every((viewKey) => visibleViewSetBlock.includes(`'${viewKey}'`)) && !['lease_rent_history_excel', 'lease_attributes', 'lease_space_specs', 'tenant_master', 'fund_capital_tranches', 'asset_specs', 'operating_costs'].some((viewKey) => visibleViewSetBlock.includes(`'${viewKey}'`))],
  ['manager_hidden_relationship', !/field_key:\s*'relationship'/u.test(managerFieldBlock)],
  ['manager_hidden_exception_group', !/field_key:\s*'exception_group'/u.test(managerFieldBlock)],
  ['lease_required_current_rent', /field_key:\s*'current_monthly_rent_total'/u.test(api)],
  ['lease_required_current_mf', /field_key:\s*'current_monthly_mf_total'/u.test(api)],
  ['lease_required_enoc', /field_key:\s*'e_noc'/u.test(api)],
  ['lease_required_exclusive_ratio', /field_key:\s*'exclusive_ratio'/u.test(api)],
  ['lease_required_contract_period', /field_key:\s*'current_contract_period'/u.test(api)],
  ['lease_required_per_py_fields', /field_key:\s*'current_rent_per_py'/u.test(leaseGeneralFieldBlock) && /field_key:\s*'current_mf_per_py'/u.test(leaseGeneralFieldBlock)],
  ['lease_required_spec_special_tenant_summary', /field_key:\s*'required_specs_summary'/u.test(leaseGeneralFieldBlock) && /field_key:\s*'lease_special_summary'/u.test(leaseGeneralFieldBlock) && /field_key:\s*'tenant_info_summary'/u.test(leaseGeneralFieldBlock)],
  ['rent_history_per_py', /field_key:\s*'rent_per_py'/u.test(api) && /field_key:\s*'mf_per_py'/u.test(api)],
  ['asset_integrated_api_view', /view_key:\s*'asset_integrated'/u.test(api) && /async function dataManagementAssetIntegratedRows/u.test(api)],
  ['asset_integrated_fields', ['asset_name', 'fund_names', 'gross_floor_area_sqm', 'exclusive_ratio', 'spec_summary', 'operating_cost_total_krw'].every((field) => assetIntegratedFieldBlock.includes(`field_key: '${field}'`))],
  ['investment_integrated_api_view', /view_key:\s*'investment_integrated'/u.test(api) && /async function dataManagementInvestmentIntegratedRows/u.test(api)],
  ['investment_integrated_fields', ['equity_amount_krw', 'loan_amount_krw', 'total_capital_krw', 'equity_parties', 'loan_lenders'].every((field) => investmentIntegratedFieldBlock.includes(`field_key: '${field}'`)) && !['tranche_summary', 'weighted_loan_rate', 'nearest_maturity_date', 'maturity_summary', 'asset_manager_name'].some((field) => investmentIntegratedFieldBlock.includes(`field_key: '${field}'`))],
  ['summaries_not_arbitrarily_truncated', !/\.slice\(0,\s*8\)/u.test(assetIntegratedRowsBlock) && !/\.slice\(0,\s*8\)/u.test(investmentIntegratedRowsBlock) && !/\.slice\(0,\s*8\)/u.test(leaseContractRowsBlock)],
  ['summary_labels_hide_internal_keys', /function dataManagementFriendlyLabel/u.test(api) && /dataManagementLooksInternalDisplayToken/u.test(api) && /dataManagementFriendlySummaryValue/u.test(api)],
  ['investment_tranche_detail_has_rate_and_maturity', /cell_details:\s*\{/u.test(investmentIntegratedRowsBlock) && /equity_parties:\s*trancheDetail/u.test(investmentIntegratedRowsBlock) && /loan_lenders:\s*trancheDetail/u.test(investmentIntegratedRowsBlock) && /dataManagementFormatViewValue\(rate\(row\),\s*\{\s*type:\s*'percent'\s*\}\)/u.test(investmentIntegratedRowsBlock) && /safeDateText\(row\.maturity_date\)/u.test(investmentIntegratedRowsBlock)],
  ['investment_unscoped_tranche_not_duplicated_for_joint_fund', /fundLinkCount/u.test(investmentIntegratedRowsBlock) && /!trancheAssetId && \(fundLinkCount\.get\(fundId\) \|\| 0\) > 1/u.test(investmentIntegratedRowsBlock)],
  ['quality_api_view', /view_key:\s*'data_quality_findings'/u.test(api)],
  ['tenant_master_normalized_view', /'tenant_master'/u.test(normalizedViewSetBlock) && /async function dataManagementTenantMasterRows/u.test(api)],
  ['tenant_view_has_joined_rows_contract', /field_key:\s*'related_assets'/u.test(tenantFieldBlock) && /field_key:\s*'contract_count'/u.test(tenantFieldBlock)],
  ['frontend_filters_internal_columns', /isInternalFieldName/u.test(dataManagementRenderBlock) && /hasInternalToken/u.test(dataManagementRenderBlock)],
  ['fullscreen_editor_present', /data-data-management-fullscreen-editor="true"/u.test(dataManagementRenderBlock) && /setEditModalOpen\(true\)/u.test(dataManagementRenderBlock)],
  ['dm_font_scope_three_sizes', /data-management-font-scope/u.test(frontend) && /data-management-font-scope/u.test(fs.readFileSync(path.join(repoRoot, 'src/index.css'), 'utf8'))],
];

const failed = requiredChecks.filter(([, ok]) => !ok).map(([name]) => name);
const result = {
  ok: failed.length === 0,
  generated_at: new Date().toISOString(),
  checks: Object.fromEntries(requiredChecks),
  failed,
};

const artifact = path.join(artifactDir, 'data-management-field-coverage-contract-latest.json');
let writtenArtifact = artifact;
try {
  fs.writeFileSync(artifact, JSON.stringify(result, null, 2), 'utf8');
} catch (error) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  writtenArtifact = path.join(artifactDir, `data-management-field-coverage-contract-${timestamp}.json`);
  fs.writeFileSync(writtenArtifact, JSON.stringify({
    ...result,
    latest_write_warning: error instanceof Error ? error.message : String(error),
  }, null, 2), 'utf8');
}
if (!result.ok) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, artifact: writtenArtifact }, null, 2));
