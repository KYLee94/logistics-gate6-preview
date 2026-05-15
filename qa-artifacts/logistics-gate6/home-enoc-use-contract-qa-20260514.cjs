const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..');
const assetDir = path.join(repoRoot, 'src', 'components', 'system', 'workspace', 'logisticsAssetData');
const sourcePath = path.join(repoRoot, 'src', 'components', 'system', 'workspace', 'WorkspaceLogistics.jsx');
const outJson = path.join(__dirname, 'home-enoc-use-contract-qa-20260514.json');
const outMd = path.join(__dirname, 'home-enoc-use-contract-qa-20260514.md');

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '');
}

function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function calculateWeightedENoc(rows, fallbackValue) {
  const weighted = (rows || []).reduce((acc, row) => {
    const eNoc = toNumber(firstDefined(row.eNoc, row.averageENoc, row.currentENoc, row.currentENocPerPy));
    const area = toNumber(firstDefined(row.leasedAreaSqm, row.currentLeasedAreaSqm, row.totalLeasedAreaSqm, row.areaSqm));
    if (!eNoc || !area || eNoc <= 0 || area <= 0) return acc;
    acc.weightedSum += eNoc * area;
    acc.areaSum += area;
    return acc;
  }, { weightedSum: 0, areaSum: 0 });
  if (weighted.areaSum > 0) return weighted.weightedSum / weighted.areaSum;
  return toNumber(fallbackValue);
}

function parsePercentText(value) {
  if (typeof value !== 'string') return null;
  const match = value.match(/([0-9]+(?:\.[0-9]+)?)\s*%/u);
  return match ? Number(match[1]) / 100 : null;
}

function useCategory(payload) {
  const overview = payload.overview || {};
  const breakdown = payload.areaBreakdown || overview.areaBreakdown || {};
  const grossArea = toNumber(firstDefined(breakdown.grossFloorAreaSqm, overview.grossFloorAreaSqm)) || 0;
  const officeArea = toNumber(firstDefined(breakdown.officeAreaSqm, overview.officeAreaSqm)) || 0;
  const warehouseArea = toNumber(firstDefined(breakdown.warehouseAreaSqm, overview.warehouseAreaSqm)) || 0;
  const explicitColdArea = toNumber(firstDefined(overview.coldStorageAreaSqm, breakdown.coldStorageAreaSqm)) || 0;
  const coldRatio = toNumber(firstDefined(overview.coldStorageRatio, breakdown.coldStorageRatio)) || parsePercentText(firstDefined(overview.coldStorageMix, breakdown.coldStorageMix));
  const coldArea = explicitColdArea > 0
    ? explicitColdArea
    : warehouseArea > 0 && coldRatio && coldRatio > 0
      ? warehouseArea * coldRatio
      : 0;
  const ambientDirect = toNumber(firstDefined(overview.ambientStorageAreaSqm, breakdown.ambientStorageAreaSqm));
  const ambientArea = ambientDirect != null && ambientDirect > 0
    ? ambientDirect
    : Math.max(warehouseArea - coldArea, 0);
  const compositeArea = toNumber(firstDefined(
    breakdown.compositeAreaSqm,
    overview.compositeAreaSqm,
    breakdown.mixedUseAreaSqm,
    overview.mixedUseAreaSqm,
  )) || 0;
  const officeFallback = officeArea > 0 ? officeArea : Math.max(grossArea - warehouseArea - compositeArea, 0);
  return {
    '상온창고': ambientArea,
    '복합': compositeArea,
    '저온창고': coldArea,
    '사무실': officeFallback,
  };
}

const files = fs.readdirSync(assetDir).filter((name) => name.endsWith('.json')).sort();
const assets = files.map((name) => {
  const payload = JSON.parse(fs.readFileSync(path.join(assetDir, name), 'utf8'));
  const overview = payload.overview || {};
  const rows = payload.rows || [];
  const weightedENoc = calculateWeightedENoc(rows, overview.averageENoc);
  const category = useCategory(payload);
  const categoryTotal = Object.values(category).reduce((sum, value) => sum + Number(value || 0), 0);
  const flags = [];
  if (!weightedENoc || weightedENoc <= 0) flags.push('missing_or_zero_enoc');
  if (weightedENoc && weightedENoc > 200000) flags.push('outlier_high_enoc');
  if (/경산쿠팡|아레나스양지/u.test(overview.assetName || '')) flags.push('user_named_check');
  if (categoryTotal <= 0) flags.push('missing_use_category_area');
  return {
    file: name,
    assetId: overview.assetId || payload.meta?.selection?.assetId || '',
    assetName: overview.assetName || payload.meta?.selection?.assetName || name,
    fundName: overview.fundName || '',
    weightedENoc: weightedENoc ? Math.round(weightedENoc) : null,
    overviewENoc: toNumber(overview.averageENoc),
    category,
    categoryTotal,
    flags,
  };
});

const source = fs.readFileSync(sourcePath, 'utf8');
const checks = {
  weeklyFreeWeekSelector: /buildWeeklyWeekOptions/u.test(source) && /findWeeklySelection/u.test(source),
  doughnutHoverTooltip: /hoveredSegment/u.test(source)
    && /data-testid="chart-tooltip"/u.test(source)
    && /segmentFromPointer/u.test(source)
    && /onMouseMove=\{\(event\) => showSegmentTooltip\(event\)\}/u.test(source),
  normalizedUseLegend: source.includes("USE_CATEGORY_LABELS = ['상온창고', '복합', '저온창고', '사무실']"),
  tenantContractFullTable: /TenantContractFullView/u.test(source) && source.includes("title: '임차인 계약 전체'"),
  assetENocWon: /valueType: item\.key === 'average_e_noc' \? 'won'/u.test(source) && /formatWon\(firstDefined\(assetWeightedENoc/u.test(source),
  assetExpiryZoneTooltip: /expiryChartLabel/u.test(source) && /tooltipLines/u.test(source),
};

const report = {
  generatedAt: new Date().toISOString(),
  assetCount: assets.length,
  checks,
  flaggedAssets: assets.filter((asset) => asset.flags.length),
  assets,
};

fs.writeFileSync(outJson, JSON.stringify(report, null, 2), 'utf8');
fs.writeFileSync(outMd, [
  '# Home / Asset QA - E.NOC, 용도 범례, 임차인 계약',
  '',
  `- 자산 JSON 수: ${assets.length}`,
  `- flag 자산 수: ${report.flaggedAssets.length}`,
  '',
  '## 코드 체크',
  ...Object.entries(checks).map(([key, value]) => `- ${key}: ${value ? 'PASS' : 'FAIL'}`),
  '',
  '## E.NOC 확인 필요 자산',
  report.flaggedAssets.length
    ? '| 자산명 | E.NOC | overview E.NOC | flag |\n| --- | ---: | ---: | --- |\n' + report.flaggedAssets.map((asset) => `| ${asset.assetName} | ${asset.weightedENoc ?? '-'} | ${asset.overviewENoc ?? '-'} | ${asset.flags.join(', ')} |`).join('\n')
    : '- 없음',
  '',
  '## 용도 범례 기준',
  '- 허용 범례: 상온창고, 복합, 저온창고, 사무실',
  '- 하역장/공용/기타 등은 Home 도넛 범례에 직접 노출하지 않고 복합으로 합산합니다.',
  '',
].join('\n'), 'utf8');

const failedChecks = Object.entries(checks).filter(([, value]) => !value).map(([key]) => key);
if (failedChecks.length) {
  console.error(`FAILED_CHECKS=${failedChecks.join(',')}`);
  process.exit(1);
}

console.log(`ASSET_COUNT=${assets.length}`);
console.log(`FLAGGED_ASSETS=${report.flaggedAssets.length}`);
console.log(`REPORT_JSON=${outJson}`);
console.log(`REPORT_MD=${outMd}`);
