const fs = require('fs');
const path = require('path');

const root = process.cwd();
const outDir = path.join(root, 'qa-artifacts/logistics-gate6/supabase-snapshot-parity-20260513');
fs.mkdirSync(outDir, { recursive: true });

const readJson = (filePath) => JSON.parse(fs.readFileSync(path.join(root, filePath), 'utf8'));
const sumRows = (rows, getter) => rows.reduce((sum, row) => sum + (Number(getter(row)) || 0), 0);
const unique = (rows) => [...new Set(rows.filter(Boolean))];

const readback = readJson('qa-artifacts/logistics-gate6/supabase-detail-readback-20260513/result.json');
const home = readJson('src/components/system/workspace/logisticsHomeData.json');
const assetOptions = readJson('src/components/system/workspace/logisticsAssetOptionsData.json');
const companyOptions = readJson('src/components/system/workspace/logisticsCompanyOptionsData.json');

const companySnapshots = readback.queries.companySnapshots?.data || [];
const homeSnapshots = readback.queries.homeSnapshots?.data || [];
const snapshotCompanyIds = unique(companySnapshots.map((row) => row.entity_id));
const snapshotCompanyNames = unique(companySnapshots.map((row) => (
  row.payload?.profile?.tenantMasterName
  || row.payload?.profile?.company?.tenantMasterName
  || row.payload?.tenantMasterName
)));
const localCompanyIds = unique(companyOptions.map((row) => row.tenantId));

const kpis = Object.fromEntries((home.kpis || []).map((row) => [row.key, row.value]));
const latestTrend = (home.rentTrend || []).at(-1) || {};
const docsHomeSnapshot = homeSnapshots.find((row) => row.snapshot_key === 'docs_home_default') || homeSnapshots.at(-1) || {};
const docsHomeKpis = Object.fromEntries(((docsHomeSnapshot.payload || {}).kpis || []).map((row) => [row.key, row.value]));

const result = {
  generatedAt: new Date().toISOString(),
  mutationPerformed: false,
  projectRef: readback.projectRef,
  configSource: readback.configSource,
  supabaseReadback: {
    llDataQualityFindingsCount: readback.queries.findings?.count,
    llTenantsCount: readback.queries.tenants?.count,
    homeSnapshotRows: homeSnapshots.length,
    companySnapshotRows: companySnapshots.length,
    companySnapshotUniqueIds: snapshotCompanyIds.length,
    companySnapshotUniqueNames: snapshotCompanyNames.length,
  },
  companyParity: {
    localCompanyOptions: localCompanyIds.length,
    snapshotCompanyUniqueIds: snapshotCompanyIds.length,
    missingInLocal: snapshotCompanyIds.filter((id) => !localCompanyIds.includes(id)),
    missingInSnapshot: localCompanyIds.filter((id) => !snapshotCompanyIds.includes(id)),
  },
  homeMonthlyCostParity: {
    localKpiMonthlyTotalCost: kpis.monthly_total_cost,
    readbackHomeKpiMonthlyTotalCost: docsHomeKpis.monthly_total_cost,
    assetOptionMonthlyCostSum: sumRows(assetOptions, (row) => row.monthlyCostTotal),
    companyOptionMonthlyCostSum: sumRows(companyOptions, (row) => row.monthlyCostTotal || row.selectorSortMeta?.monthlyCostTotal),
    homeTopTenantsMonthlyCostSum: sumRows(home.topTenants || [], (row) => row.monthlyCostTotal || row.monthlyTotal || row.monthlyCombinedTotal),
    homeTopContractsMonthlyCostSum: sumRows(home.topContracts || [], (row) => row.monthlyTotal || row.monthlyCombinedTotal || row.monthlyCostTotal),
    latestTrendMonth: latestTrend.month,
    latestTrendRawMonthlyTotal: latestTrend.monthlyTotal,
    latestTrendAdjustedMonthlyCost: latestTrend.monthlyCostTotalAdjusted,
    latestTrendAdjustedRent: latestTrend.monthlyRentTotalAdjusted,
    latestTrendAdjustedMf: latestTrend.monthlyMfTotalAdjusted,
  },
};

const pass = result.companyParity.missingInLocal.length === 0
  && result.companyParity.missingInSnapshot.length === 0
  && result.homeMonthlyCostParity.localKpiMonthlyTotalCost === result.homeMonthlyCostParity.assetOptionMonthlyCostSum
  && result.homeMonthlyCostParity.localKpiMonthlyTotalCost === result.homeMonthlyCostParity.companyOptionMonthlyCostSum
  && result.homeMonthlyCostParity.localKpiMonthlyTotalCost === result.homeMonthlyCostParity.readbackHomeKpiMonthlyTotalCost;

result.qaStatus = pass ? 'pass_with_notes' : 'fail';
result.notes = [
  'll_data_quality_findings and ll_tenants are currently zero rows by public readback; dashboard parity must use ll_payload_snapshots and local static snapshot JSON until DB/RLS source changes.',
  'Home topTenants/topContracts are partial ranking/detail arrays and must not be used as total monthly cost evidence.',
  'Home rentTrend latest adjusted total remains a different source basis from portfolio KPI; chart labels and popup must disclose basis unless source payload is regenerated.',
];

fs.writeFileSync(path.join(outDir, 'result.json'), JSON.stringify(result, null, 2));
fs.writeFileSync(path.join(outDir, 'summary.md'), [
  '# Supabase Snapshot Parity - 2026-05-13',
  '',
  '- mutationPerformed: false',
  `- projectRef: ${result.projectRef}`,
  `- qaStatus: ${result.qaStatus}`,
  '',
  '## Company Parity',
  '',
  `- local company options: ${result.companyParity.localCompanyOptions}`,
  `- Supabase company snapshot unique ids: ${result.companyParity.snapshotCompanyUniqueIds}`,
  `- missing in local: ${result.companyParity.missingInLocal.length}`,
  `- missing in snapshot: ${result.companyParity.missingInSnapshot.length}`,
  '',
  '## Home Monthly Cost Parity',
  '',
  `- KPI monthly_total_cost: ${result.homeMonthlyCostParity.localKpiMonthlyTotalCost}`,
  `- readback docs_home_default monthly_total_cost: ${result.homeMonthlyCostParity.readbackHomeKpiMonthlyTotalCost}`,
  `- asset option monthly cost sum: ${result.homeMonthlyCostParity.assetOptionMonthlyCostSum}`,
  `- company option monthly cost sum: ${result.homeMonthlyCostParity.companyOptionMonthlyCostSum}`,
  `- topTenants partial sum: ${result.homeMonthlyCostParity.homeTopTenantsMonthlyCostSum}`,
  `- topContracts partial sum: ${result.homeMonthlyCostParity.homeTopContractsMonthlyCostSum}`,
  `- latest trend ${result.homeMonthlyCostParity.latestTrendMonth} adjusted monthly cost: ${result.homeMonthlyCostParity.latestTrendAdjustedMonthlyCost}`,
  '',
  '## Notes',
  '',
  ...result.notes.map((note) => `- ${note}`),
  '',
].join('\n'));

console.log(JSON.stringify({
  qaStatus: result.qaStatus,
  mutationPerformed: result.mutationPerformed,
  companyParity: result.companyParity,
  homeMonthlyCostParity: result.homeMonthlyCostParity,
}, null, 2));
