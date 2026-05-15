const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const sourcePath = path.join(repoRoot, 'src/components/system/workspace/WorkspaceLogistics.jsx');
const assetDir = path.join(repoRoot, 'src/components/system/workspace/logisticsAssetData');
const source = fs.readFileSync(sourcePath, 'utf8');

const perPy = (total, areaSqm) => {
  const areaPy = Number(areaSqm || 0) * 0.3025;
  return areaPy > 0 ? Number(total || 0) / areaPy : null;
};
const inspectAsset = (fileName) => {
  const payload = JSON.parse(fs.readFileSync(path.join(assetDir, fileName), 'utf8'));
  let weighted = 0;
  let areaSum = 0;
  let cold = 0;
  let ambient = 0;
  for (const row of payload.rows || []) {
    const area = Number(row.leasedAreaSqm || row.currentLeasedAreaSqm || 0);
    const cost = Number(row.currentMonthlyCostTotal || row.monthlyCostTotal || 0);
    const explicitENoc = Number(row.eNoc || row.averageENoc || 0);
    const derivedENoc = explicitENoc || perPy(cost, area);
    if (derivedENoc > 0 && area > 0) {
      weighted += derivedENoc * area;
      areaSum += area;
    }
    const storageArea = Number(row.warehouseAreaSqm || row.leasedAreaSqm || 0);
    const coldType = String(row.coldStorageType || '').toUpperCase();
    if (coldType === 'Y') cold += storageArea;
    if (coldType === 'N') ambient += storageArea;
  }
  return {
    assetName: payload.overview?.assetName,
    weightedENoc: areaSum ? weighted / areaSum : null,
    coldRatio: cold + ambient > 0 ? cold / (cold + ambient) : null,
    rows: payload.rows?.length || 0,
  };
};

const buguk = inspectAsset('asset_a112527002.json');
const arenasAnseong = inspectAsset('asset_a112505001.json');

const checks = [
  {
    id: 'enoc_fallback_uses_monthly_cost_per_py_when_explicit_enoc_missing',
    pass: source.includes('calculatePerPy(firstDefined(row.monthlyCombinedTotal, row.monthlyCostTotal, row.currentMonthlyCostTotal), area)')
      && source.includes('const derivedENoc = firstDefined(row.eNoc, row.averageENoc, calculatePerPy(monthlyCombinedTotal, leasedAreaSqm))'),
  },
  {
    id: 'portfolio_cold_ratio_uses_normalized_use_category_rows',
    pass: source.includes('const useRows = buildUseCategoryRows(payload, option, weeklyRow)')
      && source.includes("useRows.find((item) => item.label === '저온창고')")
      && source.includes("useRows.find((item) => item.label === '상온창고')"),
  },
  {
    id: 'buguk_enoc_can_be_derived_from_history_money',
    pass: buguk.weightedENoc > 27000 && buguk.weightedENoc < 28000,
    value: buguk,
  },
  {
    id: 'buguk_cold_ratio_is_zero_not_blank',
    pass: buguk.coldRatio === 0,
    value: buguk,
  },
  {
    id: 'arenas_anseong_reason_is_history_unmatched_not_no_tenant',
    pass: arenasAnseong.rows > 0 && arenasAnseong.weightedENoc === null && arenasAnseong.coldRatio > 0.24 && arenasAnseong.coldRatio < 0.26,
    value: arenasAnseong,
  },
  {
    id: 'data_quality_finding_records_enoc_and_cold_ratio_causes',
    pass: source.includes("field: 'averageENoc'")
      && source.includes("reason: rows.some((row) => row.currentMoneyStatus === 'history_unmatched') ? 'history_unmatched' : 'money_missing'")
      && source.includes("field: 'coldRatio'")
      && source.includes("reason: 'storage_area_missing'"),
  },
];

const result = {
  generatedAt: new Date().toISOString(),
  sourcePath,
  allPass: checks.every((check) => check.pass),
  checks,
};

const outDir = path.join(__dirname, 'home-enoc-coldratio-static-qa-20260515');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'result.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(result, null, 2));
if (!result.allPass) process.exit(1);
