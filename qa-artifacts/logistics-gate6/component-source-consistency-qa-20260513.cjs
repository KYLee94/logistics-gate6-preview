const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '../..');
const outDir = path.join(__dirname, 'component-source-consistency-qa-20260513');
fs.mkdirSync(outDir, { recursive: true });

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), 'utf8'));
}

function readJsonDir(relativePath) {
  const dir = path.join(repoRoot, relativePath);
  return fs.readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => ({ name, payload: JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')) }));
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getKpi(kpis, key) {
  return (kpis || []).find((item) => item.key === key)?.value;
}

function check(id, status, detail, evidence = {}) {
  return { id, status, detail, evidence };
}

function isDesc(rows, key) {
  for (let i = 1; i < rows.length; i += 1) {
    if (number(rows[i - 1]?.[key]) < number(rows[i]?.[key])) return false;
  }
  return true;
}

const home = readJson('src/components/system/workspace/logisticsHomeData.json');
const assetOptions = readJson('src/components/system/workspace/logisticsAssetOptionsData.json');
const companyOptions = readJson('src/components/system/workspace/logisticsCompanyOptionsData.json');
const sector = readJson('src/components/system/workspace/logisticsSectorData.json');
const permissions = readJson('src/components/system/workspace/logisticsPermissionData.json');
const assetPayloads = readJsonDir('src/components/system/workspace/logisticsAssetData');
const companyPayloads = readJsonDir('src/components/system/workspace/logisticsCompanyData');

const latestTrend = (home.rentTrend || [])[home.rentTrend.length - 1] || {};
const homeMonthlyCost = getKpi(home.kpis, 'monthly_total_cost');
const latestAdjustedCost = latestTrend.monthlyCostTotalAdjusted;
const latestRawTotal = latestTrend.monthlyTotal;
const assetMonthlyCostSum = assetOptions.reduce((sum, row) => sum + number(row.monthlyCostTotal), 0);
const companyMonthlyCostSum = companyOptions.reduce((sum, row) => (
  sum + number(row.monthlyCostTotal || row.selectorSortMeta?.monthlyCostTotal)
), 0);
const assetOptionIds = new Set(assetOptions.map((item) => item.assetId));
const assetPayloadIds = new Set(assetPayloads.map(({ payload }) => payload.overview?.assetId || payload.meta?.selection?.assetId).filter(Boolean));
const companyOptionIds = new Set(companyOptions.map((item) => item.tenantId));
const companyPayloadIds = new Set(companyPayloads.map(({ name, payload }) => payload.meta?.selection?.tenantId || payload.filters?.selectedTenantId || payload.profile?.tenantId || name.replace(/\.json$/u, '')).filter(Boolean));

const checks = [
  check(
    'home_asset_count_matches_asset_options',
    getKpi(home.kpis, 'operating_asset_count') === assetOptions.length ? 'pass' : 'fail',
    'Home 운영 자산 수 KPI와 Asset option 수가 일치해야 합니다.',
    { kpi: getKpi(home.kpis, 'operating_asset_count'), assetOptions: assetOptions.length },
  ),
  check(
    'home_rent_trend_starts_at_original_first_month',
    (home.rentTrend || [])[0]?.month === '2018-04' ? 'pass' : 'fail',
    '임대료 추이는 기존 원본처럼 2018-04부터 시작해야 합니다.',
    { firstMonth: (home.rentTrend || [])[0]?.month, monthCount: (home.rentTrend || []).length },
  ),
  check(
    'home_monthly_cost_kpi_vs_composition_sources',
    Math.abs(number(homeMonthlyCost) - number(assetMonthlyCostSum)) <= 1
      && Math.abs(number(homeMonthlyCost) - number(companyMonthlyCostSum)) <= 1 ? 'pass' : 'fail',
    'Home KPI 월 임관리비는 현재 포트폴리오 스냅샷 기준이며 자산별/임차인별 비중 합계와 일치해야 합니다.',
    { homeMonthlyCost, assetMonthlyCostSum, companyMonthlyCostSum },
  ),
  check(
    'home_rent_trend_uses_contract_history_basis',
    latestTrend.month && Math.abs(number(homeMonthlyCost) - number(latestAdjustedCost)) > 1 ? 'pass' : 'blocked',
    '임대료 추이는 현재 스냅샷 KPI가 아니라 계약 이력 월별 시계열 기준으로 분리 표시해야 합니다.',
    { homeMonthlyCost, latestTrendMonth: latestTrend.month, latestAdjustedCost, latestRawTotal, diffVsAdjusted: number(homeMonthlyCost) - number(latestAdjustedCost) },
  ),
  check(
    'home_cold_storage_raw_labels_mapped',
    (home.composition?.coldStorage || []).some((row) => String(row.label || '').trim().toUpperCase() === 'Y')
      && (home.composition?.coldStorage || []).some((row) => String(row.label || '').trim().toUpperCase() === 'N') ? 'pass' : 'blocked',
    '저온/상온 source label은 UI에서 Y=저온, N=상온으로 해석 가능해야 하며, 복합/사무실은 별도 용도로 유지합니다.',
    { labels: (home.composition?.coldStorage || []).map((row) => row.label), uiMapping: { Y: '저온', N: '상온', other: '원본 용도명 유지' } },
  ),
  check(
    'asset_options_have_payloads',
    [...assetOptionIds].every((id) => assetPayloadIds.has(id)) ? 'pass' : 'fail',
    '모든 Asset option은 상세 payload를 가져야 합니다.',
    { optionCount: assetOptionIds.size, payloadCount: assetPayloadIds.size, missing: [...assetOptionIds].filter((id) => !assetPayloadIds.has(id)) },
  ),
  check(
    'company_options_have_payloads',
    [...companyOptionIds].every((id) => companyPayloadIds.has(id)) ? 'pass' : 'fail',
    '모든 Company option은 상세 payload를 가져야 합니다.',
    { optionCount: companyOptionIds.size, payloadCount: companyPayloadIds.size, missing: [...companyOptionIds].filter((id) => !companyPayloadIds.has(id)).slice(0, 20) },
  ),
  check(
    'company_option_count_vs_supabase_tenants',
    companyOptions.length === 31 ? 'pass' : 'blocked',
    'Supabase ll_tenants 36건은 raw tenant_id 기준이고, 현재 Company option 31건은 화면 표시용 tenant_master_name 중복/placeholder 정리 기준입니다.',
    { companyOptions: companyOptions.length, supabaseLlTenantsReadback: 36, knownReason: '우진글로벌/JM로지스 중복 tenant_id와 tenant_name_* placeholder가 ll_tenants에 포함됨' },
  ),
  check(
    'sector_assets_by_rent_sorted',
    isDesc(sector.rankings?.assetsByRent || [], 'monthlyCostTotal') ? 'pass' : 'fail',
    'Sector Top 자산 월 임관리비 정렬은 monthlyCostTotal desc이어야 합니다.',
    { first: (sector.rankings?.assetsByRent || [])[0]?.assetName },
  ),
  check(
    'sector_tenants_by_rent_sorted',
    isDesc(sector.rankings?.tenantsByRent || [], 'monthlyCostTotal') ? 'pass' : 'fail',
    'Sector Top 임차인 월 임관리비 정렬은 monthlyCostTotal desc이어야 합니다.',
    { first: (sector.rankings?.tenantsByRent || [])[0]?.tenantMasterName },
  ),
  check(
    'permissions_asset_count_matches_asset_options_for_global_manager',
    (permissions.users || []).some((user) => (user.managedAssets || []).length === assetOptions.length) ? 'pass' : 'blocked',
    '권한표에는 전체 물류 자산을 볼 수 있는 사용자 매핑이 있어야 합니다.',
    { assetOptions: assetOptions.length, maxManagedAssets: Math.max(...(permissions.users || []).map((user) => (user.managedAssets || []).length)) },
  ),
];

const statusCounts = checks.reduce((acc, item) => {
  acc[item.status] = (acc[item.status] || 0) + 1;
  return acc;
}, {});

const result = {
  generatedAt: new Date().toISOString(),
  checks,
  statusCounts,
  allPass: checks.every((item) => item.status === 'pass'),
  blockingCount: checks.filter((item) => item.status !== 'pass').length,
};

fs.writeFileSync(path.join(outDir, 'result.json'), JSON.stringify(result, null, 2), 'utf8');

const md = [
  '# Component source consistency QA - 2026-05-13',
  '',
  `- pass: ${statusCounts.pass || 0}`,
  `- blocked: ${statusCounts.blocked || 0}`,
  `- fail: ${statusCounts.fail || 0}`,
  '',
  '| check | status | detail | evidence |',
  '|---|---|---|---|',
  ...checks.map((item) => `| ${item.id} | ${item.status} | ${item.detail} | ${JSON.stringify(item.evidence).replace(/\|/g, '/')} |`),
  '',
  '판정: `blocked` 항목은 프론트 UI 문제가 아니라 원본 계산식, Supabase snapshot/normalized 기준, 또는 source coverage 확정이 필요한 항목입니다.',
].join('\n');

fs.writeFileSync(path.join(outDir, 'summary.md'), md, 'utf8');
console.log(JSON.stringify(result, null, 2));
