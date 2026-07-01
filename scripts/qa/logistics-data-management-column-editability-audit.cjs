const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outJson = path.join(OUT_DIR, `data-management-column-editability-audit-${stamp}.json`);
const latestJson = path.join(OUT_DIR, 'data-management-column-editability-audit-latest.json');

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

function has(source, needle) {
  return source.includes(needle);
}

function between(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  if (start < 0) return '';
  const end = source.indexOf(endNeedle, start + startNeedle.length);
  return source.slice(start, end < 0 ? source.length : end);
}

function check(name, pass, details = {}) {
  return { name, pass: Boolean(pass), ...details };
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const ui = read('src/components/system/workspace/LogisticsSectorModules.jsx');
const api = read('supabase/functions/ll-dashboard-api/index.ts');
const liveQa = fs.existsSync(path.join(ROOT, 'scripts/qa/logistics-data-management-live-browser-flow.cjs'))
  ? read('scripts/qa/logistics-data-management-live-browser-flow.cjs')
  : '';

const specialStatusBlock = between(api, 'const DATA_MANAGEMENT_LEASE_SPECIAL_STATUS_VIEW_FIELDS = [', '];');
const visibleFieldBlock = between(api, 'function dataManagementUserVisibleField', 'function dataManagementEditableField');
const specialDetailBlock = between(api, 'lease_special_summary: {', 'insurance_rights_summary:');
const specReaderBlock = between(api, 'async function listLeaseSpaceSpecsForLeaseSpaces', 'async function listSpecialTermsForLeaseSpaces');
const insuranceReaderBlock = between(api, 'async function listInsuranceRightsForLeaseSpaces', 'async function listTenantsByIds');
const trancheDetailBlock = between(api, 'const trancheDetail = {', 'return stripUndefined({');
const forbiddenSpecialStatusFields = [
  'current_start_date',
  'current_end_date',
  'tenant_cost_burden',
  'early_termination_right',
  'renewal_option',
  'deposit_amount',
  'rent_free_months',
  'fit_out_months',
  'tenant_improvement_amount',
  'rent_escalation_rate',
  'management_fee_escalation_rate',
  'extension_count',
];
const hiddenOperationalFields = [
  'attribute_key',
  'attribute_type',
  'source_legacy_id',
  'source_sheet_row_id',
  'source_cell_id',
  'target_table',
  'target_row_id',
  'primary_key_field',
  'relationship_type',
  'exception_group',
];

const report = {
  ok: false,
  generated_at: new Date().toISOString(),
  mode: 'data_management_column_editability_audit',
  checks: [],
  artifacts: {
    latest_json: path.relative(ROOT, latestJson).replace(/\\/g, '/'),
  },
};

report.checks.push(
  check('data_management_header_help_component_exists', has(ui, 'function DataManagementHeaderHelp')),
  check('header_help_has_dom_marker', has(ui, 'data-data-management-header-help="true"') && has(ui, 'data-data-management-header-tooltip="true"')),
  check('main_table_uses_header_help', has(ui, '<DataManagementHeaderHelp help={dataManagementColumnHelp(column)}')),
  check('fullscreen_table_uses_header_help', has(ui, 'key={`fullscreen-${key}`}') && has(ui, '<DataManagementHeaderHelp help={dataManagementColumnHelp(column)}')),
  check('detail_table_uses_header_help', has(ui, 'key={`detail-head-${key}`}') && has(ui, '<DataManagementHeaderHelp help={dataManagementColumnHelp(column)}>')),
  check('yn_columns_supported', has(ui, "type === 'yn'") && has(api, "type: 'yn'")),
  check('load_error_keeps_cached_data', has(ui, 'fallbackCached?.data') && has(ui, 'USER_FACING_LOAD_ERROR_TEXT')),
  check('blocking_error_requires_empty_data', has(ui, 'blockingViewsError') && has(ui, 'blockingRowsError')),
  check('detail_columns_filter_internal_fields', has(ui, 'visibleDetailColumns') && has(ui, '!isInternalFieldName([column.field_key, column.field, column.label, column.group]')),
  check('special_status_selector_uses_special_view_only', has(ui, "workflow: 'special_status'") && has(ui, "viewKeys: ['lease_attributes']")),
  check('no_special_status_duplicate_group_name', !has(api, "group: '특약·상태'")),
  check(
    'special_status_view_excludes_contract_schedule_and_money_terms',
    forbiddenSpecialStatusFields.every((field) => !specialStatusBlock.includes(field)),
    { forbidden: forbiddenSpecialStatusFields.filter((field) => specialStatusBlock.includes(field)) },
  ),
  check(
    'special_detail_only_contains_special_term_rows',
    specialDetailBlock.includes('specialDirectRows')
      && specialDetailBlock.includes('specialAttributeRows')
      && !specialDetailBlock.includes('insuranceRows')
      && !specialDetailBlock.includes('rentHistoryDetailRows'),
  ),
  check('required_spec_rows_are_read_back', specReaderBlock.includes("['space_spec', 'required_spec']")),
  check('insurance_right_rows_are_read_back', insuranceReaderBlock.includes("eq('attribute_type', 'insurance_right')") && api.includes('insuranceAttributeRows')),
  check('tranche_detail_uses_sections_without_duplicate_top_rows', trancheDetailBlock.includes("layout: 'fund_overview'") && trancheDetailBlock.includes('rows: []') && trancheDetailBlock.includes('sections: [')),
  check(
    'internal_operational_fields_hidden_from_public_fields',
    hiddenOperationalFields.every((field) => visibleFieldBlock.includes(`'${field}'`)),
    { missing: hiddenOperationalFields.filter((field) => !visibleFieldBlock.includes(`'${field}'`)) },
  ),
  check('live_qa_checks_internal_tokens', has(liveQa, 'INTERNAL_TOKEN_PATTERN')),
);

report.ok = report.checks.every((item) => item.pass);
fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
fs.writeFileSync(latestJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
if (!report.ok) {
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
}
console.log(JSON.stringify(report, null, 2));
