const fs = require('fs');
const path = require('path');

const root = process.cwd();
const sourcePath = path.join(root, 'src/components/system/workspace/WorkspaceLogistics.jsx');
const source = fs.readFileSync(sourcePath, 'utf8');
const outDir = path.join(root, 'qa-artifacts/logistics-gate6/advanced-tabs-static-qa-20260513');
fs.mkdirSync(outDir, { recursive: true });

const checks = [
  {
    id: 'playground_modes_restored',
    status: /PLAYGROUND_MODES[\s\S]*sandbox[\s\S]*explorer[\s\S]*workspace/u.test(source)
      && source.includes('PLAYGROUND_MODES.map((item)')
      ? 'pass' : 'fail',
    detail: 'Data Playground must restore Sandbox / Explorer / BI Workspace modes.',
  },
  {
    id: 'playground_excel_pivot_controls',
    status: source.includes('rowDimension: dimension')
      && source.includes('columnDimension')
      && source.includes('secondaryMetric')
      && source.includes('다중 값 요약')
      && source.includes('BI WORKSPACE')
      ? 'pass' : 'fail',
    detail: 'Data Playground must behave like an Excel pivot with row, column, value, secondary value, and BI audit controls.',
  },
  {
    id: 'playground_dimensions_restored',
    status: ['assetName', 'fundName', 'tenantMasterName', 'sector', 'goodsType', 'coldStorageType', 'calculatedReviewStatus'].every((key) => source.includes(`key: '${key}'`)) ? 'pass' : 'fail',
    detail: 'Data Playground must expose original 7 dimensions.',
  },
  {
    id: 'playground_metrics_restored',
    status: ['leasedAreaSqm', 'currentMonthlyRentTotal', 'currentMonthlyMfTotal', 'monthlyCostTotal', 'eNoc', 'count'].every((key) => source.includes(`key: '${key}'`)) ? 'pass' : 'fail',
    detail: 'Data Playground must expose original 6 metrics.',
  },
  {
    id: 'playground_row_detail_modal',
    status: source.includes('Data Playground 차트 상세') && source.includes('row.sourceRows.slice(0, 80)') ? 'pass' : 'fail',
    detail: 'Data Playground chart/table interactions must open detail tables.',
  },
  {
    id: 'analysis_multi_select_restored',
    status: source.includes('selectedAssetIds') && source.includes('selectedCompanyIds') && source.includes('선택 계약 원장') ? 'pass' : 'fail',
    detail: 'Analysis Tools must support multi asset/company selection and a selected contract ledger.',
  },
  {
    id: 'analysis_review_highlights_restored',
    status: source.includes('reviewHighlights') && source.includes('검토 필요 항목') ? 'pass' : 'fail',
    detail: 'Analysis Tools must expose review highlights.',
  },
  {
    id: 'quality_sheet_field_filters',
    status: source.includes('sheetFilter') && source.includes('fieldFilter') && source.includes('시트·필드별 필터') ? 'pass' : 'fail',
    detail: 'Data Quality must support sheet/field filtering.',
  },
  {
    id: 'quality_critical_severity',
    status: source.includes("'critical'") && source.includes('OpenDART/latestRevenue') ? 'pass' : 'fail',
    detail: 'Data Quality must distinguish critical source/API findings.',
  },
];

const statusCounts = checks.reduce((acc, check) => {
  acc[check.status] = (acc[check.status] || 0) + 1;
  return acc;
}, {});
const result = {
  generatedAt: new Date().toISOString(),
  checks,
  statusCounts,
  allPass: checks.every((check) => check.status === 'pass'),
};

fs.writeFileSync(path.join(outDir, 'result.json'), JSON.stringify(result, null, 2));
fs.writeFileSync(path.join(outDir, 'summary.md'), [
  '# Advanced tabs static QA - 2026-05-13',
  '',
  `- pass: ${statusCounts.pass || 0}`,
  `- fail: ${statusCounts.fail || 0}`,
  '',
  '| check | status | detail |',
  '|---|---|---|',
  ...checks.map((check) => `| ${check.id} | ${check.status} | ${check.detail} |`),
  '',
  `판정: ${result.allPass ? 'pass' : 'fail'}`,
  '',
].join('\n'));

console.log(JSON.stringify(result, null, 2));
