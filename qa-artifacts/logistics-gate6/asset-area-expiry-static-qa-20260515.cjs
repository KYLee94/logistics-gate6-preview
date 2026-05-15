const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const sourcePath = path.join(repoRoot, 'src', 'components', 'system', 'workspace', 'WorkspaceLogistics.jsx');
const assetDataDir = path.join(repoRoot, 'src', 'components', 'system', 'workspace', 'logisticsAssetData');
const outDir = path.join(__dirname, 'asset-area-expiry-static-qa-20260515');
fs.mkdirSync(outDir, { recursive: true });

const source = fs.readFileSync(sourcePath, 'utf8');

function extractBetween(text, start, end) {
  const startIndex = text.indexOf(start);
  if (startIndex === -1) return '';
  const endIndex = text.indexOf(end, startIndex + start.length);
  return endIndex === -1 ? text.slice(startIndex) : text.slice(startIndex, endIndex);
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '') ?? null;
}

function sumRows(rows, selector) {
  return (rows || []).reduce((sum, row) => {
    const value = Number(selector(row) || 0);
    return Number.isFinite(value) ? sum + value : sum;
  }, 0);
}

function computeAssetAreaBasis(asset) {
  const overview = asset.overview || {};
  const breakdown = asset.areaBreakdown || {};
  const rows = asset.rows || [];
  const kpis = asset.kpis || [];
  const kpiByKey = Object.fromEntries(kpis.map((item) => [item.key, item]));

  const exclusiveAreaSqm = Number(firstDefined(
    breakdown.exclusiveAreaSqm,
    Number(breakdown.warehouseAreaSqm || 0) + Number(breakdown.dockAreaSqm || 0) + Number(breakdown.officeAreaSqm || 0) + Number(breakdown.otherExclusiveAreaSqm || 0),
  ) || 0);
  const commonAreaSqm = Number(firstDefined(
    breakdown.commonAreaSqm,
    Number(breakdown.coreAreaSqm || 0) + Number(breakdown.corridorAreaSqm || 0) + Number(breakdown.mechanicalAreaSqm || 0) + Number(breakdown.otherCommonAreaSqm || 0) + Number(breakdown.rampAreaSqm || 0) + Number(breakdown.parkingAreaSqm || 0),
  ) || 0);
  const recomputedGrossAreaSqm = exclusiveAreaSqm + commonAreaSqm;
  const sourceGrossAreaSqm = Number(firstDefined(breakdown.grossFloorAreaSqm, overview.grossFloorAreaSqm) || 0);
  const leasedAreaForBasisSqm = Number(firstDefined(
    overview.leasedAreaSqm,
    kpiByKey.leased_area_total?.value,
    sumRows(rows, (row) => firstDefined(row.leasedAreaSqm, row.currentLeasedAreaSqm)),
    0,
  ) || 0);
  const vacancyAreaForBasisSqm = Number(firstDefined(
    overview.vacancyAreaSqm,
    breakdown.vacancyAreaSqm,
    kpiByKey.vacancy_area_total?.value,
    0,
  ) || 0);
  const occupancyGrossAreaSqm = leasedAreaForBasisSqm + vacancyAreaForBasisSqm;
  const areaBasisSqm = Math.max(sourceGrossAreaSqm, recomputedGrossAreaSqm, occupancyGrossAreaSqm);

  return {
    assetName: overview.assetName || asset.assetName || path.basename(asset.__file || ''),
    exclusiveAreaSqm,
    commonAreaSqm,
    recomputedGrossAreaSqm,
    sourceGrossAreaSqm,
    leasedAreaForBasisSqm,
    vacancyAreaForBasisSqm,
    occupancyGrossAreaSqm,
    areaBasisSqm,
  };
}

const assetDashboardSource = extractBetween(source, 'function AssetDashboard()', 'function DashboardShell');
const areaRowsSource = extractBetween(assetDashboardSource, 'const areaRows = [', 'const rosterHeaders');
const rosterSource = extractBetween(assetDashboardSource, 'const rosterHeaders =', 'const expiryRows');

const assetFiles = fs.readdirSync(assetDataDir).filter((name) => /^asset_.*\.json$/.test(name));
const areaAudit = assetFiles.map((file) => {
  const asset = JSON.parse(fs.readFileSync(path.join(assetDataDir, file), 'utf8'));
  asset.__file = file;
  return { file, ...computeAssetAreaBasis(asset) };
});

const impossibleAfterUiBasis = areaAudit.filter((row) => (
  row.areaBasisSqm + 0.0001 < row.exclusiveAreaSqm ||
  row.areaBasisSqm + 0.0001 < row.leasedAreaForBasisSqm
));
const sourceGrossSmallerThanExclusive = areaAudit.filter((row) => (
  row.sourceGrossAreaSqm > 0 && row.sourceGrossAreaSqm + 0.0001 < row.exclusiveAreaSqm
));

const checks = [
  {
    id: 'asset_area_basis_uses_source_recomputed_occupancy_max',
    pass: assetDashboardSource.includes('const occupancyGrossAreaSqm = leasedAreaForBasisSqm + vacancyAreaForBasisSqm;') &&
      assetDashboardSource.includes('const areaBasisSqm = Math.max(sourceGrossAreaSqm, recomputedGrossAreaSqm, occupancyGrossAreaSqm);'),
    detail: 'UI total area basis must not be smaller than source gross, recomputed exclusive+common, or leased+vacancy basis.',
  },
  {
    id: 'asset_area_rows_exclude_leased_and_vacancy',
    pass: !areaRowsSource.includes('임대면적') && !areaRowsSource.includes('공실면적'),
    detail: 'Area composition rows should not include leased area or vacancy area rows.',
  },
  {
    id: 'asset_area_ratio_uses_total_area_basis',
    pass: assetDashboardSource.includes('const areaRatio = (value) => (areaBasisSqm > 0 ? formatPercent(Number(value || 0) / areaBasisSqm) : \'-\');'),
    detail: 'All area ratios must use the same total area basis.',
  },
  {
    id: 'asset_area_basis_not_smaller_than_exclusive_or_leased',
    pass: impossibleAfterUiBasis.length === 0,
    detail: `${impossibleAfterUiBasis.length} assets would still show total area smaller than exclusive or leased area.`,
  },
  {
    id: 'asset_expiry_tooltip_has_zone_date_and_remaining_months',
    pass: assetDashboardSource.includes("['구역(층)', zone]") &&
      assetDashboardSource.includes("['계약만기일', expiryDate]") &&
      assetDashboardSource.includes("['잔여개월', `${formatNumber(row.monthsToExpiry)}개월`]"),
    detail: 'Expiry chart tooltip must show zone/floor, expiry date, and remaining months.',
  },
  {
    id: 'asset_header_shows_fund_name',
    pass: assetDashboardSource.includes('overview.fundName') && assetDashboardSource.includes('pb-1 text-[13px]'),
    detail: 'Fund name must be shown beside the asset name in smaller text.',
  },
  {
    id: 'asset_e_noc_uses_won_format',
    pass: assetDashboardSource.includes("item.key === 'average_e_noc'") && assetDashboardSource.includes('formatWon(firstDefined(assetWeightedENoc'),
    detail: 'E.NOC must use won format in KPI/detail audit display.',
  },
  {
    id: 'asset_core_tenant_component_removed',
    pass: !assetDashboardSource.includes('핵심 임차인'),
    detail: 'The separate key tenant component should remain removed.',
  },
  {
    id: 'asset_roster_headers_include_e_noc_before_rent_per_py',
    pass: rosterSource.includes("'E. NOC', '평당 임대료'"),
    detail: 'Tenant roster must show E. NOC immediately before rent per py.',
  },
  {
    id: 'asset_roster_rows_include_e_noc_before_rent_per_py',
    pass: rosterSource.includes('formatWon(firstDefined(row.eNoc, row.averageENoc, row.currentENoc, row.currentENocPerPy))') &&
      rosterSource.indexOf('formatWon(firstDefined(row.eNoc, row.averageENoc, row.currentENoc, row.currentENocPerPy))') <
        rosterSource.indexOf('formatWon(row.currentRentPerPy)'),
    detail: 'Tenant roster row values must include E. NOC before rent per py.',
  },
  {
    id: 'asset_roster_space_column_width_is_compact',
    pass: source.includes("else if (spaceLike) width = '118px';"),
    detail: 'Floor/detail-zone column width must stay compact enough for Asset tenant roster.',
  },
];

const result = {
  generatedAt: new Date().toISOString(),
  sourcePath,
  assetCount: assetFiles.length,
  checks,
  pass: checks.every((check) => check.pass),
  sourceGrossSmallerThanExclusive,
  impossibleAfterUiBasis,
};

fs.writeFileSync(path.join(outDir, 'result.json'), JSON.stringify(result, null, 2), 'utf8');
console.log(`Asset area/expiry static QA: ${checks.filter((check) => check.pass).length}/${checks.length} checks passed`);
for (const check of checks) {
  console.log(`${check.pass ? 'PASS' : 'FAIL'} ${check.id} - ${check.detail}`);
}
if (sourceGrossSmallerThanExclusive.length) {
  console.log('Source gross smaller than exclusive area findings kept for data readback preview:');
  for (const row of sourceGrossSmallerThanExclusive) {
    console.log(`- ${row.file}: ${row.assetName} sourceGross=${row.sourceGrossAreaSqm} exclusive=${row.exclusiveAreaSqm}`);
  }
}
if (!result.pass) process.exit(1);
