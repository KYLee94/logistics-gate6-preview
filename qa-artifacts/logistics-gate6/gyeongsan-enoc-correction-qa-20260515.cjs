const fs = require('node:fs');
const path = require('node:path');
const XLSX = require('xlsx');

const repo = process.cwd();
const outDir = path.join(repo, 'qa-artifacts', 'logistics-gate6', 'gyeongsan-enoc-correction-qa-20260515');
const assetPath = path.join(repo, 'src', 'components', 'system', 'workspace', 'logisticsAssetData', 'asset_a120085001.json');
const companyPath = path.join(repo, 'src', 'components', 'system', 'workspace', 'logisticsCompanyData', 'tenant_brn_1208800767.json');
const sourcePath = path.join(repo, 'src', 'components', 'system', 'workspace', 'WorkspaceLogistics.jsx');
const sourceExcelPath = 'C:\\Users\\10524\\Desktop\\codex_realasset\\Project\\03_Logi_Leasing_Dashboard\\★ 260414_물류센터 임대차계약 DB_취합본.xlsx';

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(Number(value || 0) * factor) / factor;
}

function calculateWeightedENoc(rows) {
  const weighted = (rows || []).reduce((acc, row) => {
    const eNoc = Number(row.eNoc ?? row.averageENoc ?? row.currentENoc ?? row.currentENocPerPy);
    const area = Number(row.leasedAreaSqm ?? row.currentLeasedAreaSqm ?? row.totalLeasedAreaSqm ?? row.areaSqm);
    if (!Number.isFinite(eNoc) || !Number.isFinite(area) || eNoc <= 0 || area <= 0) return acc;
    acc.weightedSum += eNoc * area;
    acc.areaSum += area;
    return acc;
  }, { weightedSum: 0, areaSum: 0 });
  return weighted.areaSum > 0 ? weighted.weightedSum / weighted.areaSum : null;
}

const asset = readJson(assetPath);
const company = readJson(companyPath);
const source = fs.readFileSync(sourcePath, 'utf8');
const workbook = XLSX.readFile(sourceExcelPath, { cellFormula: true, cellText: true });
const sourceSheet = workbook.Sheets['DB_일반'];
const sourceCells = {
  oneAmbient: sourceSheet?.R38 || null,
  oneCold: sourceSheet?.R39 || null,
  b2Ambient: sourceSheet?.R41 || null,
};

function findCorrectedRow(rows, floorLabel, coldStorageType, leasedAreaSqm) {
  return rows.find((row) => (
    row.assetName === '경산 쿠팡물류센터'
    && row.floorLabel === floorLabel
    && row.coldStorageType === coldStorageType
    && Number(row.leasedAreaSqm) === leasedAreaSqm
  ));
}

function findCorrectedAuditRow(rows, floorLabel, mfPerPy, leasedAreaSqm) {
  return rows?.find((row) => (
    String(row.leaseSpaceId || '').includes(`|${String(floorLabel).toLowerCase()}|na`)
    && Number(row.leasedAreaSqm) === leasedAreaSqm
    && Number(row.mfPerPy) === mfPerPy
  ));
}

const targetAssetRow = findCorrectedRow(asset.rows, 'B2', 'N', 1543.14);
const targetAssetOneAmbientRow = findCorrectedRow(asset.rows, '1', 'N', 869.95);
const targetAssetOneColdRow = findCorrectedRow(asset.rows, '1', 'Y', 8603.64);

const targetAuditRow = findCorrectedAuditRow(asset.analytics?.eNocAudit?.rows, 'b2', 3090, 1543.14);
const targetAuditOneAmbientRow = findCorrectedAuditRow(asset.analytics?.eNocAudit?.rows, '1', 3090, 869.95);
const targetAuditOneColdRow = findCorrectedAuditRow(asset.analytics?.eNocAudit?.rows, '1', 4120, 8603.64);

const targetCompanyRow = findCorrectedRow(company.rows, 'B2', 'N', 1543.14);
const targetCompanyOneAmbientRow = findCorrectedRow(company.rows, '1', 'N', 869.95);
const targetCompanyOneColdRow = findCorrectedRow(company.rows, '1', 'Y', 8603.64);

const targetAssetRows = [targetAssetOneAmbientRow, targetAssetOneColdRow, targetAssetRow];
const targetAuditRows = [targetAuditOneAmbientRow, targetAuditOneColdRow, targetAuditRow];
const targetCompanyRows = [targetCompanyOneAmbientRow, targetCompanyOneColdRow, targetCompanyRow];

const weightedENoc = calculateWeightedENoc(asset.rows);
const remainingHighRows = asset.rows
  .filter((row) => Number(row.eNoc) > 200000)
  .map((row) => ({
    floorLabel: row.floorLabel,
    coldStorageType: row.coldStorageType,
    leasedAreaSqm: row.leasedAreaSqm,
    exclusiveAreaSqm: row.exclusiveAreaSqm,
    eNoc: row.eNoc,
    sourceRowHash: row.sourceRowHash,
  }));

const checks = [
  {
    id: 'workspace_weighted_enoc_uses_contract_leased_area',
    pass: source.includes('weightedSum: acc.weightedSum + eNoc * area')
      && source.includes('areaSum: acc.areaSum + area')
      && source.includes('return weighted.weightedSum / weighted.areaSum'),
  },
  {
    id: 'target_asset_b2_ambient_exclusive_area_corrected',
    pass: Boolean(targetAssetRow)
      && Number(targetAssetRow.exclusiveAreaSqm) === 1444.85
      && Number(targetAssetRow.leasedAreaSqm) === 1543.14
      && round(targetAssetRow.exclusiveRatio, 6) === round(1444.85 / 1543.14, 6)
      && round(targetAssetRow.eNoc, 2) === 34887.67,
  },
  {
    id: 'target_asset_three_exclusive_area_rows_corrected',
    pass: Boolean(targetAssetOneAmbientRow)
      && Boolean(targetAssetOneColdRow)
      && Boolean(targetAssetRow)
      && Number(targetAssetOneAmbientRow.exclusiveAreaSqm) === 852.09
      && Number(targetAssetOneColdRow.exclusiveAreaSqm) === 8055.63
      && Number(targetAssetRow.exclusiveAreaSqm) === 1444.85
      && round(targetAssetOneAmbientRow.eNoc, 2) === 33350.18
      && round(targetAssetOneColdRow.eNoc, 2) === 53808.55
      && round(targetAssetRow.eNoc, 2) === 34887.67,
  },
  {
    id: 'target_asset_b2_ambient_audit_matches_corrected_row',
    pass: Boolean(targetAuditRow)
      && Number(targetAuditRow.exclusiveAreaSqm) === 1444.85
      && round(targetAuditRow.exclusiveRatio, 6) === round(1444.85 / 1543.14, 6)
      && round(targetAuditRow.storedENoc, 2) === 34887.67
      && round(targetAuditRow.recomputedENoc, 2) === 34887.67,
  },
  {
    id: 'target_asset_three_audit_rows_match_corrected_rows',
    pass: targetAuditRows.every(Boolean)
      && Number(targetAuditOneAmbientRow.exclusiveAreaSqm) === 852.09
      && Number(targetAuditOneColdRow.exclusiveAreaSqm) === 8055.63
      && Number(targetAuditRow.exclusiveAreaSqm) === 1444.85
      && round(targetAuditOneAmbientRow.recomputedENoc, 2) === 33350.18
      && round(targetAuditOneColdRow.recomputedENoc, 2) === 53808.55
      && round(targetAuditRow.recomputedENoc, 2) === 34887.67,
  },
  {
    id: 'target_company_duplicate_row_matches_asset_snapshot',
    pass: Boolean(targetCompanyRow)
      && Number(targetCompanyRow.exclusiveAreaSqm) === 1444.85
      && round(targetCompanyRow.eNoc, 2) === 34887.67
      && String(targetCompanyRow.sourceRowHash || '').endsWith('|1543.14|1444.85'),
  },
  {
    id: 'target_company_three_duplicate_rows_match_asset_snapshot',
    pass: targetCompanyRows.every(Boolean)
      && Number(targetCompanyOneAmbientRow.exclusiveAreaSqm) === 852.09
      && Number(targetCompanyOneColdRow.exclusiveAreaSqm) === 8055.63
      && Number(targetCompanyRow.exclusiveAreaSqm) === 1444.85
      && round(targetCompanyOneAmbientRow.eNoc, 2) === 33350.18
      && round(targetCompanyOneColdRow.eNoc, 2) === 53808.55
      && round(targetCompanyRow.eNoc, 2) === 34887.67,
  },
  {
    id: 'source_excel_readback_records_user_reported_before_values',
    pass: Boolean(sourceCells.oneAmbient)
      && Boolean(sourceCells.oneCold)
      && Boolean(sourceCells.b2Ambient)
      && Number(sourceCells.oneAmbient.v) === 8970.67
      && Number(sourceCells.oneCold.v) === 8970.67
      && Number(sourceCells.b2Ambient.v) === 10219.43,
  },
  {
    id: 'asset_overview_average_matches_row_weighted_recalculation',
    pass: round(weightedENoc, 1) === round(asset.overview.averageENoc, 1)
      && round(weightedENoc, 1) === round(asset.kpis.find((item) => item.key === 'average_e_noc')?.value, 1),
  },
];

const result = {
  generated_at: new Date().toISOString(),
  qa_status: checks.every((check) => check.pass) ? 'pass' : 'fail',
  files_checked: [assetPath, companyPath, sourcePath, sourceExcelPath],
  target: {
    assetName: '경산 쿠팡물류센터',
    floorLabel: 'B2',
    coldStorageType: 'N',
    leasedAreaSqm: 1543.14,
    sourceExcelCells: {
      oneAmbient: 'DB_일반!R38',
      oneCold: 'DB_일반!R39',
      b2Ambient: 'DB_일반!R41',
    },
    sourceExcelBeforeValues: {
      oneAmbient: sourceCells.oneAmbient?.v,
      oneCold: sourceCells.oneCold?.v,
      b2Ambient: sourceCells.b2Ambient?.v,
    },
    correctedRows: [
      { floorLabel: '1', coldStorageType: 'N', leasedAreaSqm: 869.95, correctedExclusiveAreaSqm: 852.09, correctedENoc: 33350.18 },
      { floorLabel: '1', coldStorageType: 'Y', leasedAreaSqm: 8603.64, correctedExclusiveAreaSqm: 8055.63, correctedENoc: 53808.55 },
      { floorLabel: 'B2', coldStorageType: 'N', leasedAreaSqm: 1543.14, correctedExclusiveAreaSqm: 1444.85, correctedENoc: 34887.67 },
    ],
    weightedAssetENoc: round(weightedENoc, 2),
  },
  checks,
  remainingHighRows,
  note: 'remainingHighRows는 이번 1층 N/Y 및 B2 N 보정 이후에도 자산 평균을 높게 만드는 추가 전수점검 후보입니다. 이번 QA의 pass/fail은 사용자가 지정한 전용면적 3건 보정과 가중평균 연결 검증 기준입니다.',
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'result.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
fs.writeFileSync(path.join(outDir, 'summary.md'), [
  '# 경산 쿠팡물류센터 E.NOC 보정 QA',
  '',
  `- 판정: ${result.qa_status.toUpperCase()}`,
  `- 대상: ${result.target.assetName} 전용면적 3건`,
  `- 원본 Excel 확인: DB_일반!R38=${result.target.sourceExcelBeforeValues.oneAmbient}, DB_일반!R39=${result.target.sourceExcelBeforeValues.oneCold}, DB_일반!R41=${result.target.sourceExcelBeforeValues.b2Ambient}`,
  `- 보정 row: ${result.target.correctedRows.map((row) => `${row.floorLabel}/${row.coldStorageType} ${row.correctedExclusiveAreaSqm}`).join(', ')}`,
  `- 자산 임대면적 가중평균 E.NOC: ${result.target.weightedAssetENoc}`,
  '',
  '## 체크',
  ...checks.map((check) => `- ${check.id}: ${check.pass ? 'PASS' : 'FAIL'}`),
  '',
  '## 추가 전수점검 후보',
  remainingHighRows.length
    ? '| floor | 구분 | 임대면적 | 전용면적 | E.NOC |\n| --- | --- | ---: | ---: | ---: |\n' + remainingHighRows.map((row) => `| ${row.floorLabel} | ${row.coldStorageType} | ${row.leasedAreaSqm} | ${row.exclusiveAreaSqm} | ${row.eNoc} |`).join('\n')
    : '- 없음',
  '',
].join('\n'), 'utf8');

console.log(JSON.stringify(result, null, 2));
if (result.qa_status !== 'pass') process.exit(1);
