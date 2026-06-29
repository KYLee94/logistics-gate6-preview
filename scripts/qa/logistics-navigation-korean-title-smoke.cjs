const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const artifactDir = path.join(repoRoot, 'qa-artifacts', 'logistics-gate6');
fs.mkdirSync(artifactDir, { recursive: true });

const nav = fs.readFileSync(path.join(repoRoot, 'src/components/system/IotaLeftNav.jsx'), 'utf8');
const workspace = fs.readFileSync(path.join(repoRoot, 'src/components/system/workspace/WorkspaceLogistics.jsx'), 'utf8');
const routes = fs.readFileSync(path.join(repoRoot, 'src/components/system/workspace/logisticsRoutes.js'), 'utf8');

function sliceBetween(text, startNeedle, endNeedle) {
  const start = text.indexOf(startNeedle);
  if (start < 0) return '';
  const end = text.indexOf(endNeedle, start + startNeedle.length);
  return end < 0 ? text.slice(start) : text.slice(start, end);
}

const dashboardItemsBlock = sliceBetween(nav, 'const logisticsDashboardItems', 'const LOGISTICS_DASHBOARD_FEATURE_BY_PATH');
const marketItemsBlock = sliceBetween(nav, 'const logisticsMarketDataItems', 'const logisticsDataManagementItems');
const dataManagementItemsBlock = sliceBetween(nav, 'const logisticsDataManagementItems', 'const logisticsStandaloneItems');
const moduleBlock = sliceBetween(workspace, 'const MODULES = [', '];');

const forbiddenVisibleLabels = [
  /label:\s*'Home'/u,
  /label:\s*'Asset'/u,
  /label:\s*'Company'/u,
  /label:\s*'Investment Index'/u,
  /label:\s*'Asset Spec'/u,
  /label:\s*'Market Data'/u,
  /label:\s*'Data Quality'/u,
  /label:\s*'PDF Report'/u,
];

const checks = [
  ['dashboard_visible_items_korean', /label:\s*'홈'/u.test(dashboardItemsBlock) && /label:\s*'자산'/u.test(dashboardItemsBlock) && /label:\s*'기업'/u.test(dashboardItemsBlock)],
  ['market_visible_items_korean', /label:\s*'시장 개요'/u.test(marketItemsBlock) && /label:\s*'임대 시장'/u.test(marketItemsBlock) && /label:\s*'공급 예정'/u.test(marketItemsBlock)],
  ['data_management_visible_items_korean', /label:\s*'자산 Data'/u.test(dataManagementItemsBlock) && /label:\s*'데이터 품질'/u.test(dataManagementItemsBlock)],
  ['nav_items_no_english_primary_labels', forbiddenVisibleLabels.every((pattern) => !pattern.test(dashboardItemsBlock) && !pattern.test(marketItemsBlock) && !pattern.test(dataManagementItemsBlock))],
  ['data_quality_under_data_management', /data-management\/data-quality/u.test(dataManagementItemsBlock) && !/dashboard\/quality/u.test(dashboardItemsBlock)],
  ['workspace_module_labels_korean', /label:\s*'홈'/u.test(moduleBlock) && /label:\s*'투자 지수'/u.test(moduleBlock) && /label:\s*'데이터 품질'/u.test(moduleBlock)],
  ['route_quality_redirects_to_dm', /'data-quality': `\$\{LOGISTICS_INTERNAL_BASE\}\/data-management\/data-quality`/u.test(routes)],
  ['old_dashboard_quality_redirects', /dashboard\/quality/.test(routes) && /data-management\/data-quality/.test(routes)],
];

const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
const result = { ok: failed.length === 0, generated_at: new Date().toISOString(), checks: Object.fromEntries(checks), failed };
const artifact = path.join(artifactDir, 'navigation-korean-title-smoke-latest.json');
fs.writeFileSync(artifact, JSON.stringify(result, null, 2), 'utf8');
if (!result.ok) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, artifact }, null, 2));
