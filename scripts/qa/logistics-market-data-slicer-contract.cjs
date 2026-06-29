const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const artifactDir = path.join(repoRoot, 'qa-artifacts', 'logistics-gate6');
fs.mkdirSync(artifactDir, { recursive: true });

const source = fs.readFileSync(path.join(repoRoot, 'src/components/system/workspace/LogisticsSectorModules.jsx'), 'utf8');

function sliceBetween(text, startNeedle, endNeedle) {
  const start = text.indexOf(startNeedle);
  if (start < 0) return '';
  const end = text.indexOf(endNeedle, start + startNeedle.length);
  return end < 0 ? text.slice(start) : text.slice(start, end);
}

const filterPillsBody = sliceBetween(source, 'function FilterPills', 'function FilterSelect');
const filterMultiSelectBody = sliceBetween(source, 'function FilterMultiSelect', 'function FilterBlock');
const regionBody = sliceBetween(source, 'function RegionFilterGroups', 'export function MarketDataDashboard');
const modalBody = sliceBetween(source, 'function Modal', 'function FilterPills');
const useEdgeDataBody = sliceBetween(source, 'function useEdgeData', 'function Modal');
const overviewRenderBody = source;

const checks = [
  ['filter_pills_render_dropdown', /data-market-filter-control="dropdown"/u.test(filterPillsBody) && /<select/u.test(filterPillsBody)],
  ['filter_pills_no_button_slicer', !/<button[\s\S]*onClick=\{\(\) => onChange\(optionValue\)\}/u.test(filterPillsBody)],
  ['region_filter_uses_multi_select', /<FilterMultiSelect label=\{label\}/u.test(regionBody) && /data-market-filter-control="multi-select"/u.test(filterMultiSelectBody)],
  ['region_filter_supports_multi_value', /function selectedRegionValues/u.test(source) && /function regionSelectionValue/u.test(source) && /split\('\|'\)/u.test(source)],
  ['region_filter_portal_popover', /createPortal\(menu,\s*document\.body\)/u.test(filterMultiSelectBody) && /data-market-filter-portal="multi-select"/u.test(filterMultiSelectBody)],
  ['region_filter_not_modal_backdrop', !/role="dialog"|aria-modal|bg-black\/70/u.test(filterMultiSelectBody)],
  ['region_filter_event_isolation', /onPointerDown=\{\(event\) => event\.stopPropagation\(\)\}/u.test(filterMultiSelectBody) && /onClick=\{\(event\) => event\.stopPropagation\(\)\}/u.test(filterMultiSelectBody) && /event\.key === 'Escape'/u.test(filterMultiSelectBody)],
  ['market_modal_is_portal_and_target_close_only', /createPortal\(modal,\s*document\.body\)/u.test(modalBody) && /event\.target === event\.currentTarget/u.test(modalBody)],
  ['market_data_error_boundary_present', /class MarketDataErrorBoundary extends React\.Component/u.test(source) && /<MarketDataErrorBoundary resetKey=\{activeTab\}>/u.test(source)],
  ['edge_data_keeps_stale_data_on_payload_change', /data:\s*current\.data \|\| null/u.test(useEdgeDataBody) && /silent:\s*stateRef\.current\.sourceKey === payloadKey && Boolean\(stateRef\.current\.data\)/u.test(useEdgeDataBody)],
  ['temperature_options_mix_merged', /const TRANSACTION_TEMPERATURE_OPTIONS = \['전체', '상온', '저온', 'Mix'\]/u.test(source)],
  ['temperature_normalizer_merges_mix', /function normalizeMarketTemperature/u.test(source) && /MIX/u.test(source) && /return 'Mix';/u.test(source)],
  ['overview_lease_has_period_metric_region_temp', /overviewLeaseSelectedPeriod/u.test(overviewRenderBody) && /overviewLeaseSelectedMetric/u.test(overviewRenderBody) && /overviewLeaseRegion/u.test(overviewRenderBody) && /overviewLeaseTemp/u.test(overviewRenderBody)],
  ['overview_transaction_has_metric_region_temp', /overviewTxnMetric/u.test(overviewRenderBody) && /overviewTxnRegion/u.test(overviewRenderBody) && /overviewTxnTemp/u.test(overviewRenderBody)],
  ['overview_transaction_popup_connected', /onRowClick=\{openOverviewTransactionModal\}/u.test(overviewRenderBody) && /openOverviewTransactionModal/u.test(source)],
  ['popup_uses_filter_dropdown_component', /setModal\(\{[\s\S]*fullscreen:\s*true/u.test(source) && /FilterSelect/u.test(source)],
];

const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
const result = { ok: failed.length === 0, generated_at: new Date().toISOString(), checks: Object.fromEntries(checks), failed };
const artifact = path.join(artifactDir, 'market-data-slicer-contract-latest.json');
fs.writeFileSync(artifact, JSON.stringify(result, null, 2), 'utf8');
if (!result.ok) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, artifact }, null, 2));
