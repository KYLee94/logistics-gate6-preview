const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..');
const sourcePath = path.join(repoRoot, 'src', 'components', 'system', 'workspace', 'WorkspaceLogistics.jsx');
const outDir = path.join(__dirname, 'current-user-fixes-static-qa-20260514');
fs.mkdirSync(outDir, { recursive: true });

const source = fs.readFileSync(sourcePath, 'utf8');

function between(start, end) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  if (startIndex < 0 || endIndex < 0) return '';
  return source.slice(startIndex, endIndex);
}

const doughnutBlock = between('function DoughnutBreakdownChart', 'function MiniLineChart');
const trendBlock = between('function RichTrendChart', 'function TrendChart');
const assetBlock = between('function AssetDashboard', 'function DashboardShell');
const companyBlock = between('function CompanyDashboard', 'function AnalysisToolsDashboard');
const analysisBlock = between('function AnalysisToolsDashboard', 'function DataPlaygroundDashboard');
const dataQualityBlock = between('function DataQualityDashboard', 'function AssetDashboard');
const searchBlock = between('function DashboardSearchPreview', 'function WeeklyWordUploadPanel');

const checks = {
  doughnutUsesExactArcPaths: /describeArcPath\(21, 21, 15\.915, startAngle, endAngle\)/u.test(doughnutBlock)
    && /pointerEvents: 'stroke'/u.test(doughnutBlock)
    && !/strokeDasharray=\{dash\}/u.test(doughnutBlock),
  expiryAxisReadableAndNicePy: /function buildAxisSpec/u.test(source)
    && /const leftAxis = buildAxisSpec/u.test(trendBlock)
    && /primaryValueType === 'area' \? '면적\(평\)'/u.test(trendBlock)
    && /fontSize="13" fontWeight="600"/u.test(trendBlock),
  assetAreaCompositionRemovesLeaseVacancyAndRecomputes: /recomputedGrossAreaSqm = exclusiveAreaSqm \+ commonAreaSqm/u.test(assetBlock)
    && !/임대면적 subtotal/u.test(assetBlock)
    && !/공실면적 subtotal/u.test(assetBlock)
    && /areaRatio\(breakdown\.warehouseAreaSqm\)/u.test(assetBlock),
  companyMapNarrowDartWide: /xl:grid-cols-\[3\.5fr_6\.5fr\]/u.test(companyBlock)
    && /회사별 임차 자산 지도/u.test(companyBlock)
    && /DART 상세 정보/u.test(companyBlock),
  analysisToolsMetricSelectable: /benchmarkMetric/u.test(analysisBlock)
    && /setBenchmarkMetric/u.test(analysisBlock)
    && /metricValueFromRow\(row, benchmarkMetric\)/u.test(analysisBlock),
  dataQualityExcelLikeEditGrid: /Excel-like edit grid/u.test(dataQualityBlock)
    && /beforeValue/u.test(dataQualityBlock)
    && /afterValue/u.test(dataQualityBlock)
    && /cell_edits/u.test(dataQualityBlock)
    && /target_cell_id/u.test(dataQualityBlock),
  searchPreviewRemovesAssetMapAndAddsDetail: !/PortfolioMapPlot points=\{mapPoint\}/u.test(searchBlock)
    && /Weekly 주요 이슈/u.test(searchBlock)
    && /사업자번호/u.test(searchBlock)
    && /평당 임대료/u.test(searchBlock),
};

const report = {
  generatedAt: new Date().toISOString(),
  checks,
  allPass: Object.values(checks).every(Boolean),
};

fs.writeFileSync(path.join(outDir, 'result.json'), JSON.stringify(report, null, 2), 'utf8');
console.log(JSON.stringify(report, null, 2));

if (!report.allPass) process.exit(1);
