const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const sourcePath = path.join(repoRoot, 'src/components/system/workspace/WorkspaceLogistics.jsx');
const source = fs.readFileSync(sourcePath, 'utf8');

const checks = [
  {
    id: 'rich_trend_chart_supports_right_axis_color',
    pass: source.includes('rightAxisColor =') && source.includes('fill={rightAxisColor}') && source.includes('stroke={rightSeries.length > 0 ? rightAxisColor'),
  },
  {
    id: 'contract_rent_trend_right_axis_is_asset_count_purple',
    pass: source.includes('rightAxisColor="#C7A6FF"') && source.includes("key: 'activeAssetCount'") && source.includes("color: '#C7A6FF'"),
  },
  {
    id: 'rich_trend_chart_supports_bar_series',
    pass: source.includes("chartType: item.chartType || item.type || 'line'") && source.includes("item.chartType === 'bar'") && source.includes('key={`${item.key}-bars`}'),
  },
  {
    id: 'maturity_concentration_uses_bar_and_line',
    pass: source.includes("key: 'expiringAreaSqm'") && source.includes("chartType: 'bar'") && source.includes("key: 'uniqueTenantCount'") && source.includes("rightAxisColor=\"#FFD166\""),
  },
  {
    id: 'maturity_concentration_has_larger_plot_area',
    pass: source.includes('chartHeight={520}') && source.includes('chartHeightClass="h-[500px]"'),
  },
];

const result = {
  generatedAt: new Date().toISOString(),
  sourcePath,
  allPass: checks.every((check) => check.pass),
  checks,
};

const outDir = path.join(__dirname, 'home-chart-axis-mixed-static-qa-20260515');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'result.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');

console.log(JSON.stringify(result, null, 2));
if (!result.allPass) process.exit(1);
