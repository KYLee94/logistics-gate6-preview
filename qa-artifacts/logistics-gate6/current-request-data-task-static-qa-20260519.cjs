const fs = require('fs');
const path = require('path');

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const logisticsSource = read('src/components/system/workspace/WorkspaceLogistics.jsx');
const archiveSource = read('src/components/system/workspace/WorkspaceArchive.jsx');
const edgeSource = read('supabase/functions/ll-dashboard-api/index.ts');
const assetOptions = JSON.parse(read('src/components/system/workspace/logisticsAssetOptionsData.json'));
const weeklyReport = JSON.parse(read('src/components/system/workspace/logisticsWeeklyReportData.json'));
const arenaYangjiPayload = JSON.parse(read('src/components/system/workspace/logisticsAssetData/asset_a112127001.json'));

const monthlyCostTotal = assetOptions.reduce((sum, row) => sum + Number(row.monthlyCostTotal || 0), 0);
const arenaYangji = assetOptions.find((row) => String(row.assetName || '').includes('아레나스양지'));
const managementProjectNames = (weeklyReport.managementProjects || []).map((row) => row.projectName);
const arenaYangjiRows = arenaYangjiPayload.normalizedRows || [];
const arenaYangjiFloorCount = new Set(arenaYangjiRows.map((row) => row.floorLabel).filter(Boolean)).size;
const arenaYangjiRowsWithExpiry = arenaYangjiRows.filter((row) => row.currentEndDate || row.latestExpiry || row.earliestExpiry).length;

const checks = {
  archiveSupportsLogisticsWorkspace: archiveSource.includes("id: 'logistics'") && archiveSource.includes('ll_work_platform_tasks'),
  archiveUsesLogisticsEdgeList: archiveSource.includes("action: 'work-platform/tasks/list'") && archiveSource.includes('include_archived: true'),
  archiveDoesNotUseBrokenSetter: !archiveSource.includes('setSelectedSnapshotId('),
  edgeListSupportsArchivedFlag: edgeSource.includes('include_archived') && edgeSource.includes('include_deleted'),
  monthlyCostAssetModeShowsAllAssets: logisticsSource.includes("return mode === 'asset' ? 32 : 8") && logisticsSource.includes('maxRows={monthlyCostCompositionLimit(costCompositionMode)}'),
  arenaYangjiIncludedInMonthlyCostSnapshot: Boolean(arenaYangji && Number(arenaYangji.monthlyCostTotal || 0) > 0),
  monthlyCostTotalMatchesSnapshot: monthlyCostTotal === 13050719577,
  rentTrendHasGrossFloorAreaSeries: logisticsSource.includes("key: 'grossFloorAreaSqm'") && logisticsSource.includes("label: '보유 연면적'"),
  assetTabHasManagementProjectPanel: logisticsSource.includes('function AssetProjectInfoPanel') && logisticsSource.includes('<AssetProjectInfoPanel assetName={overview.assetName} />'),
  weeklyManagementProjectsParsed: managementProjectNames.length === 5
    && managementProjectNames.includes('이천 회억리 물류센터')
    && managementProjectNames.includes('인천 석남 물류센터'),
  arenaYangjiStaleMonthlyCostRemoved: !read('src/components/system/workspace/logisticsAssetOptionsData.json').includes('552212356')
    && !read('src/components/system/workspace/logisticsSectorData.json').includes('552212356'),
  assetTabBuildsStackingFromNormalizedRows: logisticsSource.includes('buildStackingFloorsFromRows(rows, overview.floors || asset.stackingPlan)')
    && logisticsSource.includes('typeof tenant === \'string\''),
  assetTabFallsBackExpiryRowsFromNormalizedRows: logisticsSource.includes('buildExpiryRowsFromRows(corrected.rows.length ? corrected.rows : explicitExpiryRows)')
    && arenaYangjiRowsWithExpiry === arenaYangjiRows.length
    && arenaYangjiFloorCount >= 12,
};

const failed = Object.entries(checks).filter(([, value]) => !value);
const result = {
  qa_status: failed.length ? 'fail' : 'pass',
  checks,
  evidence: {
    monthlyCostTotal,
    monthlyCostTotalEok: Number((monthlyCostTotal / 100000000).toFixed(1)),
    arenaYangjiMonthlyCostTotal: arenaYangji?.monthlyCostTotal || null,
    arenaYangjiNormalizedRows: arenaYangjiRows.length,
    arenaYangjiRowsWithExpiry,
    arenaYangjiFloorCount,
    arenaYangjiRawExpiryRows: arenaYangjiPayload.analytics?.expirySnapshot?.entries?.length || arenaYangjiPayload.analytics?.contractExpiry?.length || 0,
    assetOptionCount: assetOptions.length,
    managementProjectNames,
  },
  failed: failed.map(([key]) => key),
};

console.log(JSON.stringify(result, null, 2));
if (failed.length) process.exit(1);
