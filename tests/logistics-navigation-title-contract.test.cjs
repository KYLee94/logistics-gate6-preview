const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const repoRoot = path.resolve(__dirname, '..');
const navSource = fs.readFileSync(path.join(repoRoot, 'src/components/system/IotaLeftNav.jsx'), 'utf8');
const workspaceSource = fs.readFileSync(path.join(repoRoot, 'src/components/system/workspace/WorkspaceLogistics.jsx'), 'utf8');
const sectorSource = fs.readFileSync(path.join(repoRoot, 'src/components/system/workspace/LogisticsSectorModules.jsx'), 'utf8');

function sliceBetween(source, start, end) {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `Cannot find ${start}`);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(endIndex, -1, `Cannot find end marker ${end}`);
  return source.slice(startIndex, endIndex);
}

function labelsByPath(source, blockStart, blockEnd) {
  const block = sliceBetween(source, blockStart, blockEnd);
  return Object.fromEntries([...block.matchAll(/label:\s*'([^']+)'[\s\S]*?path:\s*`\$\{LOGISTICS_INTERNAL_BASE\}\/([^`]+)`/g)]
    .map(([, label, route]) => [route, label]));
}

test('left navigation titles match their rendered page titles', () => {
  const dashboardNav = labelsByPath(navSource, 'const logisticsDashboardItems = [', 'const LOGISTICS_DASHBOARD_FEATURE_BY_PATH');
  const marketNav = labelsByPath(navSource, 'const logisticsMarketDataItems = [', 'const logisticsDataManagementItems');
  const dataManagementNav = labelsByPath(navSource, 'const logisticsDataManagementItems = [', 'const logisticsStandaloneItems');

  const dashboardTitles = {
    home: '대시보드 홈',
    asset: '자산',
    company: '기업',
    'investment-index': '투자 정보',
    'asset-spec': '자산별 스펙 비교',
    tools: '분석 도구',
    playground: '피벗 테이블',
  };
  const marketTitles = {
    overview: '시장 데이터 홈',
    lease: '임대 시장',
    supply: '공급 예정',
    transactions: '거래 사례',
    source: '업데이트',
  };
  const dataManagementTitles = {
    asset: '자산 데이터',
    investment: '투자 데이터',
    lease: '임대차계약 데이터',
    managers: '담당자 데이터',
    quality: '데이터 품질',
    approval: '승인 대기',
  };
  const dashboardTitleBlock = sliceBetween(workspaceSource, 'const selectedTitle = {', 'const shouldShowExternalApiRefresh');
  const marketTitleBlock = sliceBetween(sectorSource, 'const MARKET_TAB_TITLES = {', 'const MARKET_TAB_SUBTITLES');

  assert.match(workspaceSource, /<h1[^>]*>플랫폼 홈<\/h1>/);
  assert.equal(navSource.match(/const logisticsRootItem = \{[\s\S]*?label: '([^']+)'/)?.[1], '플랫폼 홈');
  for (const [route, title] of Object.entries(dashboardTitles)) {
    assert.equal(dashboardNav[`dashboard/${route}`], title, route);
    assert.match(dashboardTitleBlock, new RegExp(`['"]?${route}['"]?:\\s*'${title}'`));
  }
  for (const [route, title] of Object.entries(marketTitles)) {
    const navigationRoute = route === 'lease' ? 'lease-market' : route === 'supply' ? 'supply-pipeline' : route === 'source' ? 'source-update' : route;
    assert.equal(marketNav[`market-data/${navigationRoute}`], title, route);
    assert.match(marketTitleBlock, new RegExp(`${route}: '${title}'`));
  }
  for (const [route, title] of Object.entries(dataManagementTitles)) assert.match(sectorSource, new RegExp(`${route}:\\s*\\{[\\s\\S]*?title: '${title}'`));

  assert.equal(dataManagementNav['data-management/asset-data'], dataManagementTitles.asset);
  assert.equal(dataManagementNav['data-management/investment-data'], dataManagementTitles.investment);
  assert.equal(dataManagementNav['data-management/lease-contracts'], dataManagementTitles.lease);
  assert.equal(dataManagementNav['data-management/managers'], dataManagementTitles.managers);
  assert.equal(dataManagementNav['data-management/data-quality'], dataManagementTitles.quality);
  assert.equal(dataManagementNav['data-management/approval'], dataManagementTitles.approval);
  assert.match(workspaceSource, /title="PDF 보고서"/);
  assert.equal(navSource.match(/const logisticsStandaloneItems = \[[\s\S]*?label: '([^']+)'/)?.[1], 'PDF 보고서');
});
